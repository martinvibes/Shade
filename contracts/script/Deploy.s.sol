// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ShadeVault} from "../src/ShadeVault.sol";
import {ShadeVerifier} from "../src/ShadeVerifier.sol";

/// @notice Deploy ShadeVault + ShadeVerifier to any EVM chain.
///         Agent wallet stays owner of both. Vault is set as authorized
///         caller on verifier so spendAndLog() works. Agent can also
///         call verifier.logTask() directly for non-payment tasks.
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 agentId = vm.envOr("AGENT_ID", uint256(0));
        uint256 maxPerTx = vm.envOr("MAX_PER_TX_WEI", uint256(0.01 ether));
        uint256 dailyBudget = vm.envOr("DAILY_BUDGET_WEI", uint256(0.05 ether));

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ShadeVerifier (owner = deployer)
        ShadeVerifier verifier = new ShadeVerifier(agentId);
        console.log("ShadeVerifier:", address(verifier));

        // 2. Deploy ShadeVault (owner = deployer)
        ShadeVault vault = new ShadeVault(agentId, maxPerTx, dailyBudget);
        console.log("ShadeVault:", address(vault));

        // 3. Authorize vault to also call logTask on verifier
        verifier.setAuthorizedCaller(address(vault));
        console.log("Vault authorized on Verifier");

        // 4. Link verifier in vault
        vault.setVerifier(address(verifier));
        console.log("Vault linked to Verifier");

        console.log("=== Deployment Complete ===");
        console.log("Agent ID:", agentId);
        console.log("Max per tx (wei):", maxPerTx);
        console.log("Daily budget (wei):", dailyBudget);

        vm.stopBroadcast();
    }
}
