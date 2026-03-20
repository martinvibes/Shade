// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ShadeVerifier} from "../src/ShadeVerifier.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ShadeVerifierTest is Test {
    event TaskLogged(
        uint256 indexed taskIndex,
        bytes32 indexed taskHash,
        string intentCategory,
        uint256 cost,
        bool success
    );

    ShadeVerifier public verifier;
    address public attacker;

    uint256 constant AGENT_ID = 42;

    function setUp() public {
        verifier = new ShadeVerifier(AGENT_ID);
        attacker = makeAddr("attacker");
    }

    // ── Constructor ──

    function test_constructor() public view {
        assertEq(verifier.agentId(), AGENT_ID);
        assertEq(verifier.taskCount(), 0);
        assertEq(verifier.successCount(), 0);
        assertEq(verifier.totalSpent(), 0);
    }

    // ── Log task ──

    function test_logTask() public {
        bytes32 taskHash = keccak256("Buy weather API access");
        bytes32 disclosureHash = keccak256('{"identity":"hidden"}');

        uint256 idx = verifier.logTask(
            taskHash,
            disclosureHash,
            "data access",
            0.5 ether,
            5,
            2,
            true
        );

        assertEq(idx, 0);
        assertEq(verifier.taskCount(), 1);
        assertEq(verifier.successCount(), 1);
        assertEq(verifier.totalSpent(), 0.5 ether);
    }

    function test_logTask_emitsEvent() public {
        bytes32 taskHash = keccak256("Buy API");

        vm.expectEmit(true, true, false, true);
        emit TaskLogged(0, taskHash, "data access", 0.5 ether, true);

        verifier.logTask(
            taskHash,
            keccak256("disclosure"),
            "data access",
            0.5 ether,
            5,
            2,
            true
        );
    }

    function test_logTask_failedTask() public {
        verifier.logTask(
            keccak256("failed task"),
            keccak256("disclosure"),
            "payment",
            0,
            7,
            0,
            false
        );

        assertEq(verifier.taskCount(), 1);
        assertEq(verifier.successCount(), 0);
    }

    function test_logTask_multiple() public {
        verifier.logTask(keccak256("task1"), keccak256("d1"), "data", 1 ether, 5, 2, true);
        verifier.logTask(keccak256("task2"), keccak256("d2"), "payment", 2 ether, 6, 1, true);
        verifier.logTask(keccak256("task3"), keccak256("d3"), "compute", 0.5 ether, 4, 3, false);

        assertEq(verifier.taskCount(), 3);
        assertEq(verifier.successCount(), 2);
        assertEq(verifier.totalSpent(), 3.5 ether);
    }

    function test_revert_logTask_emptyHash() public {
        vm.expectRevert("Task hash required");
        verifier.logTask(bytes32(0), keccak256("d"), "test", 0, 0, 0, true);
    }

    function test_revert_logTask_notAuthorized() public {
        vm.prank(attacker);
        vm.expectRevert("Not authorized");
        verifier.logTask(keccak256("task"), keccak256("d"), "test", 0, 0, 0, true);
    }

    // ── Verify task ──

    function test_verifyTask() public {
        bytes32 taskHash = keccak256("Buy weather API");
        verifier.logTask(taskHash, keccak256("d"), "data access", 1 ether, 5, 2, true);

        (
            bool exists,
            string memory cat,
            uint256 cost,
            uint8 hidden,
            uint8 revealed,
            bool success,
            uint256 ts
        ) = verifier.verifyTask(taskHash);

        assertTrue(exists);
        assertEq(cat, "data access");
        assertEq(cost, 1 ether);
        assertEq(hidden, 5);
        assertEq(revealed, 2);
        assertTrue(success);
        assertGt(ts, 0);
    }

    function test_verifyTask_notFound() public view {
        (bool exists,,,,,,) = verifier.verifyTask(keccak256("nonexistent"));
        assertFalse(exists);
    }

    // ── Get receipt ──

    function test_getReceipt() public {
        bytes32 taskHash = keccak256("task1");
        verifier.logTask(taskHash, keccak256("d"), "data", 1 ether, 5, 2, true);

        ShadeVerifier.TaskReceipt memory r = verifier.getReceipt(0);
        assertEq(r.taskHash, taskHash);
        assertEq(r.cost, 1 ether);
        assertEq(r.fieldsHidden, 5);
        assertTrue(r.success);
    }

    function test_revert_getReceipt_invalid() public {
        vm.expectRevert("Receipt does not exist");
        verifier.getReceipt(0);
    }

    // ── Privacy score ──

    function test_getPrivacyScore_empty() public view {
        (uint256 score,,) = verifier.getPrivacyScore();
        assertEq(score, 100); // no tasks = 100% private
    }

    function test_getPrivacyScore() public {
        verifier.logTask(keccak256("t1"), keccak256("d"), "a", 0, 5, 2, true);
        verifier.logTask(keccak256("t2"), keccak256("d"), "b", 0, 6, 1, true);

        (uint256 score, uint256 hidden, uint256 revealed) = verifier.getPrivacyScore();
        assertEq(hidden, 11);
        assertEq(revealed, 3);
        // 11 / 14 * 100 = 78
        assertEq(score, 78);
    }

    // ── Agent stats ──

    function test_getAgentStats() public {
        verifier.logTask(keccak256("t1"), keccak256("d"), "a", 1 ether, 5, 2, true);
        verifier.logTask(keccak256("t2"), keccak256("d"), "b", 2 ether, 6, 1, false);

        (
            uint256 id,
            uint256 tasks,
            uint256 successes,
            uint256 spent,
            uint256 privacy
        ) = verifier.getAgentStats();

        assertEq(id, AGENT_ID);
        assertEq(tasks, 2);
        assertEq(successes, 1);
        assertEq(spent, 3 ether);
        // (5+6) / (5+2+6+1) = 11/14 = 78
        assertEq(privacy, 78);
    }

    // ── Set agent ID ──

    function test_setAgentId() public {
        verifier.setAgentId(99);
        assertEq(verifier.agentId(), 99);
    }

    function test_revert_setAgentId_notOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        verifier.setAgentId(99);
    }
}
