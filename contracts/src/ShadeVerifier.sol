// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ShadeVerifier — On-chain proof of agent task execution
/// @notice Stores privacy-preserving receipts of completed agent tasks.
///         Anyone can verify a task happened; no one can see the full details.
///
///         Each receipt contains:
///         - taskHash: keccak256 of the full task description (private)
///         - disclosureHash: keccak256 of the disclosure manifest (what was hidden/revealed)
///         - intentCategory: the ONLY plain-text field — broad category like "data access"
///         - cost: how much was spent (in wei)
///         - fieldsHidden / fieldsRevealed: counts, not contents
///         - success: whether the task completed successfully
///
///         The operator's identity is never stored or emitted.
contract ShadeVerifier is Ownable {
    /// @notice ERC-8004 agent ID this verifier is linked to
    uint256 public agentId;

    /// @notice Additional address authorized to log tasks (e.g., ShadeVault)
    address public authorizedCaller;

    /// @notice Total number of tasks executed
    uint256 public taskCount;

    /// @notice Total number of successful tasks
    uint256 public successCount;

    /// @notice Total ETH spent across all tasks (wei)
    uint256 public totalSpent;

    /// @notice A single task execution receipt
    struct TaskReceipt {
        bytes32 taskHash;           // keccak256(taskDescription) — verifiable but private
        bytes32 disclosureHash;     // keccak256(disclosureManifest JSON)
        string intentCategory;     // broad category only: "data access", "payment", etc.
        uint256 cost;              // amount spent (wei)
        uint8 fieldsHidden;        // how many data fields were hidden
        uint8 fieldsRevealed;      // how many data fields were revealed
        bool success;              // did the task complete successfully
        uint256 timestamp;         // when the receipt was logged
    }

    /// @notice All task receipts, indexed by task number
    mapping(uint256 => TaskReceipt) public receipts;

    /// @notice Look up receipt index by taskHash (for external verification)
    mapping(bytes32 => uint256) public receiptByTaskHash;

    // ── Events ──

    /// @notice Emitted when a task receipt is logged
    event TaskLogged(
        uint256 indexed taskIndex,
        bytes32 indexed taskHash,
        string intentCategory,
        uint256 cost,
        bool success
    );

    /// @notice Emitted when the agent ID is updated
    event AgentIdUpdated(uint256 oldAgentId, uint256 newAgentId);

    /// @notice Emitted when authorized caller is updated
    event AuthorizedCallerSet(address indexed caller);

    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || msg.sender == authorizedCaller,
            "Not authorized"
        );
        _;
    }

    constructor(uint256 _agentId) Ownable(msg.sender) {
        agentId = _agentId;
    }

    /// @notice Set an additional authorized caller (e.g., ShadeVault)
    function setAuthorizedCaller(address _caller) external onlyOwner {
        authorizedCaller = _caller;
        emit AuthorizedCallerSet(_caller);
    }

    /// @notice Log a completed task as an on-chain receipt.
    ///         Called by the owner OR the authorized caller (vault).
    /// @param taskHash keccak256 of the full task description
    /// @param disclosureHash keccak256 of the disclosure manifest JSON
    /// @param intentCategory broad category string (e.g., "data access")
    /// @param cost amount spent in wei
    /// @param fieldsHidden number of data fields that were hidden
    /// @param fieldsRevealed number of data fields that were revealed
    /// @param success whether the task completed successfully
    /// @return taskIndex the index of this receipt
    function logTask(
        bytes32 taskHash,
        bytes32 disclosureHash,
        string calldata intentCategory,
        uint256 cost,
        uint8 fieldsHidden,
        uint8 fieldsRevealed,
        bool success
    ) external onlyAuthorized returns (uint256 taskIndex) {
        require(taskHash != bytes32(0), "Task hash required");
        require(receiptByTaskHash[taskHash] == 0 && taskCount == 0 || receiptByTaskHash[taskHash] == 0,
            "Task already logged");

        taskIndex = taskCount;
        taskCount++;

        if (success) {
            successCount++;
        }
        totalSpent += cost;

        receipts[taskIndex] = TaskReceipt({
            taskHash: taskHash,
            disclosureHash: disclosureHash,
            intentCategory: intentCategory,
            cost: cost,
            fieldsHidden: fieldsHidden,
            fieldsRevealed: fieldsRevealed,
            success: success,
            timestamp: block.timestamp
        });

        receiptByTaskHash[taskHash] = taskIndex;

        emit TaskLogged(taskIndex, taskHash, intentCategory, cost, success);
    }

    /// @notice Verify that a specific task was executed.
    ///         Anyone can call this — it's a public proof.
    /// @param taskHash keccak256 of the task description to verify
    /// @return exists whether a receipt exists for this task
    /// @return intentCategory the broad category of the task
    /// @return cost how much was spent
    /// @return fieldsHidden how many fields were hidden
    /// @return fieldsRevealed how many fields were revealed
    /// @return success whether it completed successfully
    /// @return timestamp when it was logged
    function verifyTask(bytes32 taskHash) external view returns (
        bool exists,
        string memory intentCategory,
        uint256 cost,
        uint8 fieldsHidden,
        uint8 fieldsRevealed,
        bool success,
        uint256 timestamp
    ) {
        uint256 idx = receiptByTaskHash[taskHash];
        TaskReceipt storage r = receipts[idx];

        // Check if the receipt actually exists (taskHash matches)
        if (r.taskHash != taskHash) {
            return (false, "", 0, 0, 0, false, 0);
        }

        return (
            true,
            r.intentCategory,
            r.cost,
            r.fieldsHidden,
            r.fieldsRevealed,
            r.success,
            r.timestamp
        );
    }

    /// @notice Get a full receipt by index
    /// @param taskIndex the index of the receipt
    function getReceipt(uint256 taskIndex) external view returns (TaskReceipt memory) {
        require(taskIndex < taskCount, "Receipt does not exist");
        return receipts[taskIndex];
    }

    /// @notice Get the agent's privacy score: percentage of fields hidden across all tasks
    /// @return score 0-100 representing privacy effectiveness
    /// @return totalHidden total fields hidden across all tasks
    /// @return totalRevealed total fields revealed across all tasks
    function getPrivacyScore() external view returns (
        uint256 score,
        uint256 totalHidden,
        uint256 totalRevealed
    ) {
        for (uint256 i = 0; i < taskCount; i++) {
            totalHidden += receipts[i].fieldsHidden;
            totalRevealed += receipts[i].fieldsRevealed;
        }

        uint256 totalFields = totalHidden + totalRevealed;
        if (totalFields == 0) {
            return (100, 0, 0);
        }

        score = (totalHidden * 100) / totalFields;
    }

    /// @notice Get agent stats summary
    /// @return _agentId the ERC-8004 agent ID
    /// @return _taskCount total tasks executed
    /// @return _successCount successful tasks
    /// @return _totalSpent total ETH spent (wei)
    /// @return _privacyScore privacy effectiveness (0-100)
    function getAgentStats() external view returns (
        uint256 _agentId,
        uint256 _taskCount,
        uint256 _successCount,
        uint256 _totalSpent,
        uint256 _privacyScore
    ) {
        _agentId = agentId;
        _taskCount = taskCount;
        _successCount = successCount;
        _totalSpent = totalSpent;

        uint256 totalHidden;
        uint256 totalRevealed;
        for (uint256 i = 0; i < taskCount; i++) {
            totalHidden += receipts[i].fieldsHidden;
            totalRevealed += receipts[i].fieldsRevealed;
        }
        uint256 totalFields = totalHidden + totalRevealed;
        _privacyScore = totalFields == 0 ? 100 : (totalHidden * 100) / totalFields;
    }

    /// @notice Update the linked ERC-8004 agent ID
    /// @param _agentId new agent ID
    function setAgentId(uint256 _agentId) external onlyOwner {
        uint256 old = agentId;
        agentId = _agentId;
        emit AgentIdUpdated(old, _agentId);
    }
}
