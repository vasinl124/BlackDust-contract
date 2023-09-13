const { ethers, upgrades } = require("hardhat");
const {
  networkConfig,
  CONTRACTS,
  contratsToDeploy,
} = require("../utils/helper-hardhat-config");
const fs = require("fs");
const func = async ({ deployments, getChainId }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  if (contratsToDeploy.blacklistOperatorFilter.deploy) {
    log(
      "======================================================================",
    );
    log(
      `====================== Contract: [${CONTRACTS.blacklistOperatorFilter}] ==========================`,
    );
    log(
      "======================================================================",
    );

    console.log("Deploying...");

    const blacklistOperatorFilter = await deploy(
      CONTRACTS.blacklistOperatorFilter,
      {
        from: deployer,
        log: true,
      },
    );

    const networkName = networkConfig[chainId]["name"];

    fs.writeFileSync(
      `${networkName}-deployment-blacklistOperatorFilter-address.json`,
      blacklistOperatorFilter.address,
    );

    log("=====================================================");
    log(
      `You have deployed an NFT contract to "${blacklistOperatorFilter.address}"`,
    );
    log("=====================================================");

    if (contratsToDeploy.blacklistOperatorFilter.verify) {
      try {
        await run("verify:verify", {
          address: blacklistOperatorFilter.address,
          constructorArguments: [],
        });
        console.log("***********************************");
        console.log("***********************************");
        console.log("\n");
        console.log(
          `[Contract] ${CONTRACTS.blacklistOperatorFilter} has been verify!`,
        );
        console.log("\n");
        console.log("***********************************");
        console.log("***********************************");
      } catch (error) {}
    } else {
      console.log("***********************************");
      console.log("***********************************");
      console.log("\n");
      `[SKIPPED] [Verify] ${CONTRACTS.blacklistOperatorFilter}!`,
        console.log("\n");
      console.log("***********************************");
      console.log("***********************************");
    }
  } else {
    log(
      "======================================================================",
    );
    log(
      `====================== [SKIPPED]: ${CONTRACTS.blacklistOperatorFilter} ==========================`,
    );
    log(
      "======================================================================",
    );
  }
};

module.exports = func;
