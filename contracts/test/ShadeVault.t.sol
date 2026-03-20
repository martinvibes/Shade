// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ShadeVault} from "../src/ShadeVault.sol";
import {ShadeVerifier} from "../src/ShadeVerifier.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ShadeVaultTest is Test {
    event SpendExecuted(address indexed recipient, uint256 amount, bytes32 intentHash);

    ShadeVault public vault;
    address public owner;
    address payable public recipient;
    address payable public recipient2;
    address public attacker;

    uint256 constant AGENT_ID = 1;
    uint256 constant MAX_PER_TX = 1 ether;
    uint256 constant DAILY_BUDGET = 5 ether;

    function setUp() public {
        owner = address(this);
        recipient = payable(makeAddr("recipient"));
        recipient2 = payable(makeAddr("recipient2"));
        attacker = makeAddr("attacker");

        vault = new ShadeVault(AGENT_ID, MAX_PER_TX, DAILY_BUDGET);
        vm.deal(address(vault), 10 ether);
        vault.setWhitelist(recipient, true);
    }

    // ── Constructor ──

    function test_constructor() public view {
        assertEq(vault.agentId(), AGENT_ID);
        assertEq(vault.maxPerTx(), MAX_PER_TX);
        assertEq(vault.dailyBudget(), DAILY_BUDGET);
        assertEq(vault.owner(), owner);
    }

    function test_revert_constructor_zeroMaxPerTx() public {
        vm.expectRevert("maxPerTx must be > 0");
        new ShadeVault(1, 0, DAILY_BUDGET);
    }

    function test_revert_constructor_budgetLessThanMax() public {
        vm.expectRevert("dailyBudget must be >= maxPerTx");
        new ShadeVault(1, 2 ether, 1 ether);
    }

    // ── Spending ──

    function test_spend() public {
        bytes32 intentHash = keccak256("data access");
        vault.spend(recipient, 0.5 ether, intentHash);

        assertEq(recipient.balance, 0.5 ether);
        assertEq(vault.spentToday(), 0.5 ether);
    }

    function test_spend_emitsEvent() public {
        bytes32 intentHash = keccak256("data access");

        vm.expectEmit(true, false, false, true);
        emit SpendExecuted(recipient, 0.5 ether, intentHash);

        vault.spend(recipient, 0.5 ether, intentHash);
    }

    function test_spend_multipleInDay() public {
        bytes32 h = keccak256("data access");

        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);

        assertEq(vault.spentToday(), 3 ether);
        assertEq(recipient.balance, 3 ether);
    }

    function test_revert_spend_exceedsPerTx() public {
        vm.expectRevert("Exceeds per-tx limit");
        vault.spend(recipient, 1.1 ether, keccak256("test"));
    }

    function test_revert_spend_exceedsDailyBudget() public {
        bytes32 h = keccak256("test");
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);

        vm.expectRevert("Exceeds daily budget");
        vault.spend(recipient, 1 ether, h);
    }

    function test_revert_spend_notWhitelisted() public {
        vm.expectRevert("Recipient not whitelisted");
        vault.spend(recipient2, 0.5 ether, keccak256("test"));
    }

    function test_revert_spend_notOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.spend(recipient, 0.5 ether, keccak256("test"));
    }

    function test_revert_spend_zeroAmount() public {
        vm.expectRevert("Amount must be > 0");
        vault.spend(recipient, 0, keccak256("test"));
    }

    function test_spend_dailyReset() public {
        bytes32 h = keccak256("test");

        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        vault.spend(recipient, 1 ether, h);
        assertEq(vault.spentToday(), 5 ether);

        vm.warp(block.timestamp + 1 days);

        vault.spend(recipient, 1 ether, h);
        assertEq(vault.spentToday(), 1 ether);
    }

    // ── Whitelist ──

    function test_setWhitelist() public {
        vault.setWhitelist(recipient2, true);
        assertTrue(vault.whitelisted(recipient2));

        vault.setWhitelist(recipient2, false);
        assertFalse(vault.whitelisted(recipient2));
    }

    function test_revert_setWhitelist_zeroAddress() public {
        vm.expectRevert("Cannot whitelist zero address");
        vault.setWhitelist(address(0), true);
    }

    function test_revert_setWhitelist_notOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.setWhitelist(recipient2, true);
    }

    // ── Policy ──

    function test_updatePolicy() public {
        vault.updatePolicy(2 ether, 10 ether);
        assertEq(vault.maxPerTx(), 2 ether);
        assertEq(vault.dailyBudget(), 10 ether);
    }

    function test_revert_updatePolicy_notOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.updatePolicy(2 ether, 10 ether);
    }

    // ── Withdraw ──

    function test_withdraw() public {
        uint256 balanceBefore = address(this).balance;
        vault.withdraw();
        assertEq(address(vault).balance, 0);
        assertEq(address(this).balance, balanceBefore + 10 ether);
    }

    function test_revert_withdraw_notOwner() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        vault.withdraw();
    }

    // ── View functions ──

    function test_getBalance() public view {
        assertEq(vault.getBalance(), 10 ether);
    }

    function test_getRemainingDailyBudget() public {
        assertEq(vault.getRemainingDailyBudget(), 5 ether);

        vault.spend(recipient, 1 ether, keccak256("test"));
        assertEq(vault.getRemainingDailyBudget(), 4 ether);
    }

    function test_getRemainingDailyBudget_resetsNextDay() public {
        vault.spend(recipient, 1 ether, keccak256("test"));
        vm.warp(block.timestamp + 1 days);
        assertEq(vault.getRemainingDailyBudget(), 5 ether);
    }

    // ── Receive ──

    function test_receive() public {
        vm.deal(makeAddr("depositor"), 1 ether);
        vm.prank(makeAddr("depositor"));
        (bool sent, ) = address(vault).call{value: 1 ether}("");
        assertTrue(sent);
        assertEq(address(vault).balance, 11 ether);
    }

    // ── Verifier integration ──

    function test_setVerifier() public {
        ShadeVerifier v = new ShadeVerifier(AGENT_ID);
        vault.setVerifier(address(v));
        assertEq(address(vault.verifier()), address(v));
    }

    function test_revert_setVerifier_zero() public {
        vm.expectRevert("Cannot set zero address");
        vault.setVerifier(address(0));
    }

    function test_spendAndLog() public {
        // Deploy verifier, authorize vault as caller, then link it
        ShadeVerifier v = new ShadeVerifier(AGENT_ID);
        v.setAuthorizedCaller(address(vault));
        vault.setVerifier(address(v));

        bytes32 taskHash = keccak256("Buy weather API");
        bytes32 disclosureHash = keccak256('{"identity":"hidden"}');
        bytes32 intentHash = keccak256("data access");

        vault.spendAndLog(
            recipient,
            0.5 ether,
            intentHash,
            taskHash,
            disclosureHash,
            "data access",
            5,
            2
        );

        // Vault state
        assertEq(recipient.balance, 0.5 ether);
        assertEq(vault.spentToday(), 0.5 ether);

        // Verifier state
        assertEq(v.taskCount(), 1);
        assertEq(v.successCount(), 1);
        assertEq(v.totalSpent(), 0.5 ether);

        // Verify the receipt
        (bool exists,,uint256 cost,uint8 hidden,,bool success,) = v.verifyTask(taskHash);
        assertTrue(exists);
        assertEq(cost, 0.5 ether);
        assertEq(hidden, 5);
        assertTrue(success);
    }

    function test_revert_spendAndLog_noVerifier() public {
        vm.expectRevert("Verifier not set");
        vault.spendAndLog(
            recipient,
            0.5 ether,
            keccak256("intent"),
            keccak256("task"),
            keccak256("disc"),
            "test",
            5,
            2
        );
    }

    receive() external payable {}
}
