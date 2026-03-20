// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ShadeVault} from "../src/ShadeVault.sol";
import {ShadeVerifier} from "../src/ShadeVerifier.sol";

/// @notice Deploy to Status Network Sepolia
contract DeployStatus is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        ShadeVerifier verifier = new ShadeVerifier(0);
        ShadeVault vault = new ShadeVault(0, 0.01 ether, 0.05 ether);

        verifier.setAuthorizedCaller(address(vault));
        vault.setVerifier(address(verifier));

        console.log("=== Status Sepolia Deployment ===");
        console.log("ShadeVerifier:", address(verifier));
        console.log("ShadeVault:", address(vault));

        vm.stopBroadcast();
    }
}
