// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ShadeVerifier} from "./ShadeVerifier.sol";

/// @title ShadeVault — Privacy-preserving agent treasury with per-user balances
/// @notice Each user has their own balance within the vault. The agent can only
///         spend from a user's balance with their deposit as the limit.
///         Events intentionally omit operator/depositor details for privacy.
contract ShadeVault is Ownable, ReentrancyGuard {
    /// @notice Maximum ETH (in wei) the agent can spend per transaction
    uint256 public maxPerTx;

    /// @notice Maximum ETH (in wei) the agent can spend per day
    uint256 public dailyBudget;

    /// @notice ETH (in wei) spent so far today
    uint256 public spentToday;

    /// @notice The day number (block.timestamp / 1 days) of the last spending reset
    uint256 public lastResetDay;

    /// @notice ERC-8004 agent ID linked to this vault
    uint256 public agentId;

    /// @notice Per-user deposit balances
    mapping(address => uint256) public userBalances;

    /// @notice Whitelisted recipients the agent is allowed to pay
    mapping(address => bool) public whitelisted;

    /// @notice Authorized caller (agent wallet) that can spend on behalf of users
    address public authorizedCaller;

    /// @notice Optional link to ShadeVerifier for auto-logging receipts
    ShadeVerifier public verifier;

    // ── Events (intentionally omit operator address for privacy) ──

    event SpendExecuted(address indexed recipient, uint256 amount, bytes32 intentHash);
    event PolicyUpdated(uint256 maxPerTx, uint256 dailyBudget);
    event RecipientWhitelisted(address indexed recipient, bool status);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event UserWithdrawn(address indexed user, uint256 amount);
    event VerifierSet(address indexed verifier);
    event AuthorizedCallerSet(address indexed caller);

    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == authorizedCaller, "Not authorized");
        _;
    }

    constructor(
        uint256 _agentId,
        uint256 _maxPerTx,
        uint256 _dailyBudget
    ) Ownable(msg.sender) {
        require(_maxPerTx > 0, "maxPerTx must be > 0");
        require(_dailyBudget >= _maxPerTx, "dailyBudget must be >= maxPerTx");

        agentId = _agentId;
        maxPerTx = _maxPerTx;
        dailyBudget = _dailyBudget;
        lastResetDay = block.timestamp / 1 days;
    }

    /// @notice Set the authorized caller (agent wallet)
    function setAuthorizedCaller(address _caller) external onlyOwner {
        authorizedCaller = _caller;
        emit AuthorizedCallerSet(_caller);
    }

    /// @notice Agent spends from a specific user's balance
    /// @param user The depositor whose balance to spend from
    /// @param recipient The address to send ETH to
    /// @param amount The amount of ETH to send (in wei)
    /// @param intentHash keccak256 of the intent category string
    function spendFrom(
        address user,
        address payable recipient,
        uint256 amount,
        bytes32 intentHash
    ) external onlyAuthorized nonReentrant {
        require(userBalances[user] >= amount, "Insufficient user balance");
        userBalances[user] -= amount;
        _executeSpend(recipient, amount, intentHash);
    }

    /// @notice Legacy spend (uses total vault balance, for backwards compat)
    function spend(
        address payable recipient,
        uint256 amount,
        bytes32 intentHash
    ) external onlyAuthorized nonReentrant {
        _executeSpend(recipient, amount, intentHash);
    }

    /// @notice Update the spending policy
    function updatePolicy(
        uint256 _maxPerTx,
        uint256 _dailyBudget
    ) external onlyOwner {
        require(_maxPerTx > 0, "maxPerTx must be > 0");
        require(_dailyBudget >= _maxPerTx, "dailyBudget must be >= maxPerTx");
        maxPerTx = _maxPerTx;
        dailyBudget = _dailyBudget;
        emit PolicyUpdated(_maxPerTx, _dailyBudget);
    }

    /// @notice Add or remove a recipient from the whitelist
    function setWhitelist(address recipient, bool status) external onlyAuthorized {
        require(recipient != address(0), "Cannot whitelist zero address");
        whitelisted[recipient] = status;
        emit RecipientWhitelisted(recipient, status);
    }

    /// @notice User withdraws their own remaining balance
    function withdrawUser() external nonReentrant {
        uint256 bal = userBalances[msg.sender];
        require(bal > 0, "No balance to withdraw");
        userBalances[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Withdrawal failed");
        emit UserWithdrawn(msg.sender, bal);
    }

    /// @notice Owner emergency withdraw
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Withdrawal failed");
        emit Withdrawn(msg.sender, balance);
    }

    /// @notice Get total vault balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get a user's deposited balance
    function getUserBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    /// @notice Get remaining daily budget
    function getRemainingDailyBudget() external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) return dailyBudget;
        if (spentToday >= dailyBudget) return 0;
        return dailyBudget - spentToday;
    }

    /// @notice Link a ShadeVerifier contract
    function setVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Cannot set zero address");
        verifier = ShadeVerifier(_verifier);
        emit VerifierSet(_verifier);
    }

    /// @notice Spend from user balance AND log receipt atomically
    function spendFromAndLog(
        address user,
        address payable recipient,
        uint256 amount,
        bytes32 intentHash,
        bytes32 taskHash,
        bytes32 disclosureHash,
        string calldata intentCategory,
        uint8 fieldsHidden,
        uint8 fieldsRevealed
    ) external onlyAuthorized nonReentrant {
        require(address(verifier) != address(0), "Verifier not set");
        require(userBalances[user] >= amount, "Insufficient user balance");
        userBalances[user] -= amount;
        _executeSpend(recipient, amount, intentHash);
        verifier.logTask(taskHash, disclosureHash, intentCategory, amount, fieldsHidden, fieldsRevealed, true);
    }

    /// @notice Legacy spendAndLog (backwards compat)
    function spendAndLog(
        address payable recipient,
        uint256 amount,
        bytes32 intentHash,
        bytes32 taskHash,
        bytes32 disclosureHash,
        string calldata intentCategory,
        uint8 fieldsHidden,
        uint8 fieldsRevealed
    ) external onlyAuthorized nonReentrant {
        require(address(verifier) != address(0), "Verifier not set");
        _executeSpend(recipient, amount, intentHash);
        verifier.logTask(taskHash, disclosureHash, intentCategory, amount, fieldsHidden, fieldsRevealed, true);
    }

    /// @notice Internal spend logic
    function _executeSpend(
        address payable recipient,
        uint256 amount,
        bytes32 intentHash
    ) internal {
        require(whitelisted[recipient], "Recipient not whitelisted");
        require(amount > 0, "Amount must be > 0");
        require(amount <= maxPerTx, "Exceeds per-tx limit");
        require(address(this).balance >= amount, "Insufficient vault balance");

        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) {
            spentToday = 0;
            lastResetDay = today;
        }
        require(spentToday + amount <= dailyBudget, "Exceeds daily budget");
        spentToday += amount;

        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Transfer failed");

        emit SpendExecuted(recipient, amount, intentHash);
    }

    /// @notice Accept ETH deposits — tracked per sender
    receive() external payable {
        userBalances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
