// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ShadeVerifier} from "./ShadeVerifier.sol";

/// @title ShadeVault — Privacy-preserving agent treasury
/// @notice Allows an agent to spend within budgets without exposing operator identity.
///         The operator deposits once; from that point, only the agent's spending
///         actions are visible on-chain. Events intentionally omit operator details.
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

    /// @notice Whitelisted recipients the agent is allowed to pay
    mapping(address => bool) public whitelisted;

    /// @notice Optional link to ShadeVerifier for auto-logging receipts
    ShadeVerifier public verifier;

    // ── Events (intentionally omit operator address for privacy) ──

    /// @notice Emitted when the agent spends from the vault
    /// @param recipient Who received the funds
    /// @param amount How much was sent (wei)
    /// @param intentHash keccak256 of the intent category (not full intent)
    event SpendExecuted(
        address indexed recipient,
        uint256 amount,
        bytes32 intentHash
    );

    /// @notice Emitted when spending policy is updated
    event PolicyUpdated(uint256 maxPerTx, uint256 dailyBudget);

    /// @notice Emitted when a recipient's whitelist status changes
    event RecipientWhitelisted(address indexed recipient, bool status);

    /// @notice Emitted when ETH is deposited into the vault
    event Deposited(uint256 amount);

    /// @notice Emitted when the operator withdraws remaining funds
    event Withdrawn(address indexed to, uint256 amount);

    /// @notice Emitted when the verifier is linked
    event VerifierSet(address indexed verifier);

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

    /// @notice Agent spends from vault to a whitelisted recipient.
    ///         Only reveals: recipient, amount, and a hash of the intent category.
    /// @param recipient The address to send ETH to (must be whitelisted)
    /// @param amount The amount of ETH to send (in wei)
    /// @param intentHash keccak256 of the intent category string
    function spend(
        address payable recipient,
        uint256 amount,
        bytes32 intentHash
    ) external onlyOwner nonReentrant {
        _executeSpend(recipient, amount, intentHash);
    }

    /// @notice Update the spending policy
    /// @param _maxPerTx New per-transaction limit (wei)
    /// @param _dailyBudget New daily budget (wei)
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
    /// @param recipient The address to update
    /// @param status true to whitelist, false to remove
    function setWhitelist(
        address recipient,
        bool status
    ) external onlyOwner {
        require(recipient != address(0), "Cannot whitelist zero address");
        whitelisted[recipient] = status;

        emit RecipientWhitelisted(recipient, status);
    }

    /// @notice Withdraw all remaining funds back to the owner.
    ///         This is the only function that sends to the owner.
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Withdrawal failed");

        emit Withdrawn(msg.sender, balance);
    }

    /// @notice Get the vault's current ETH balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get remaining daily budget
    function getRemainingDailyBudget() external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (today > lastResetDay) {
            return dailyBudget;
        }
        if (spentToday >= dailyBudget) {
            return 0;
        }
        return dailyBudget - spentToday;
    }

    /// @notice Link a ShadeVerifier contract for auto-logging receipts.
    ///         The verifier must have this vault's owner as its owner too.
    /// @param _verifier Address of the deployed ShadeVerifier
    function setVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Cannot set zero address");
        verifier = ShadeVerifier(_verifier);
        emit VerifierSet(_verifier);
    }

    /// @notice Spend from vault AND log a receipt to the verifier in one tx.
    ///         Combines payment + proof-of-execution atomically.
    /// @param recipient The address to send ETH to
    /// @param amount The amount of ETH to send (wei)
    /// @param intentHash keccak256 of the intent category
    /// @param taskHash keccak256 of the full task description
    /// @param disclosureHash keccak256 of the disclosure manifest
    /// @param intentCategory plain-text broad category
    /// @param fieldsHidden number of fields hidden
    /// @param fieldsRevealed number of fields revealed
    function spendAndLog(
        address payable recipient,
        uint256 amount,
        bytes32 intentHash,
        bytes32 taskHash,
        bytes32 disclosureHash,
        string calldata intentCategory,
        uint8 fieldsHidden,
        uint8 fieldsRevealed
    ) external onlyOwner nonReentrant {
        require(address(verifier) != address(0), "Verifier not set");

        // Execute the spend
        _executeSpend(recipient, amount, intentHash);

        // Log the receipt
        verifier.logTask(
            taskHash,
            disclosureHash,
            intentCategory,
            amount,
            fieldsHidden,
            fieldsRevealed,
            true // success — if spend didn't revert, task succeeded
        );
    }

    /// @notice Internal spend logic shared by spend() and spendAndLog()
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

    /// @notice Accept ETH deposits
    receive() external payable {
        emit Deposited(msg.value);
    }
}
