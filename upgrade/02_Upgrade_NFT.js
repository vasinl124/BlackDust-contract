const { ethers, upgrades } = require("hardhat");
const {
  networkConfig,
  CONTRACTS,
  contratsToDeploy,
} = require("../utils/helper-hardhat-config");
const fs = require("fs");

const func = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { log } = deployments;
  const chainId = await getChainId();

  const { takrut } = networkConfig[chainId];
  const { contractName } = takrut;

  if (contratsToDeploy.takrut.upgrade) {
    log(
      "======================================================================",
    );
    log(
      `================ [UPGRADING] NFT: ${contractName} ====================`,
    );
    log(
      "======================================================================",
    );

    const networkName = networkConfig[chainId]["name"];
    const NFT = await ethers.getContractFactory(CONTRACTS.nftUpgrade);
    console.log(`Upgrading...[${networkName}] NFT: ${contractName}`);
    let addresses = JSON.parse(
      fs.readFileSync(`${networkName}-deployment-takrut-addresses.json`),
    );
    const nft = await upgrades.upgradeProxy(addresses.proxy, NFT);
    console.log("Upgraded:", nft.address);

    addresses = {
      proxy: nft.address,
      admin: await upgrades.erc1967.getAdminAddress(nft.address),
      implementation: await upgrades.erc1967.getImplementationAddress(
        nft.address,
      ),
    };
    console.log("Addresses:", addresses);

    fs.writeFileSync(
      `${networkName}-deployment-takrut-addresses.json`,
      JSON.stringify(addresses, null, 2),
    );

    log("=====================================================");
    log(`You have upgraded an NFT contract to "${nft.address}"`);
    log("=====================================================");

    if (contratsToDeploy.takrut.verifyUpgrade) {
      await run("verify:verify", {
        address: addresses.implementation,
        constructorArguments: [],
      });

      console.log("***********************************");
      console.log("***********************************");
      console.log("\n");
      console.log(`[Contract] ${CONTRACTS.nftUpgrade} has been verify!`);
      console.log("\n");
      console.log("***********************************");
      console.log("***********************************");
    }
  } else {
    log(
      "======================================================================",
    );
    log(
      `====================== [SKIPPED]: ${contractName} [${CONTRACTS.nftUpgrade}] ==========================`,
    );
    log(
      "======================================================================",
    );
  }
};

func.tags = ["nft"];
func.dependencies = [CONTRACTS.devSplitter];

module.exports = func;
