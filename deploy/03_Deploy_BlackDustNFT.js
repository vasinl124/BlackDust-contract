const { ethers, upgrades } = require("hardhat");
const {
  networkConfig,
  CONTRACTS,
  contratsToDeploy,
} = require("../utils/helper-hardhat-config");
const fs = require("fs");
const func = async ({ deployments, getChainId }) => {
  const { log } = deployments;
  const chainId = await getChainId();

  const { blackdust, devMultisigAddress } = networkConfig[chainId];
  const { contractName, contractSymbol, initBaseURI, royalty } = blackdust;

  if (contratsToDeploy.blackdust.deploy) {
    log(
      "======================================================================",
    );
    log(
      `====================== NFT: ${contractName} [${CONTRACTS.blackdust}] ==========================`,
    );
    log(
      "======================================================================",
    );

    // const BlackDustNFT = await ethers.getContractFactory(CONTRACTS.blackdust);
    // console.log("Deploying...");
    // const blackdustNft = await upgrades.deployProxy(
    //   BlackDustNFT,
    //   [
    //     contractName,
    //     contractSymbol,
    //     initBaseURI,
    //     devMultisigAddress, // dev multisig
    //     royalty,
    //   ],
    //   {
    //     initializer: "initialize",
    //   },
    // );
    // await blackdustNft.deployed();
    // const addresses = {
    //   proxy: blackdustNft.address,
    //   admin: await upgrades.erc1967.getAdminAddress(blackdustNft.address),
    //   implementation: await upgrades.erc1967.getImplementationAddress(
    //     blackdustNft.address,
    //   ),
    // };
    // console.log("Addresses:", addresses);

    const networkName = networkConfig[chainId]["name"];

    // fs.writeFileSync(
    //   `${networkName}-deployment-blackdust-addresses.json`,
    //   JSON.stringify(addresses, null, 2),
    // );

    log("=====================================================");
    // log(`You have deployed an NFT contract to "${blackdustNft.address}"`);
    log("=====================================================");

    if (contratsToDeploy.blackdust.verify) {
      await run("verify:verify", {
        // address: addresses.implementation,
        address: "0x76FfE1DEC483C0cAfA8B2864D541EAd613D21384",
        constructorArguments: [],
      });

      console.log("***********************************");
      console.log("***********************************");
      console.log("\n");
      console.log(`[Contract] ${CONTRACTS.blackdust} has been verify!`);
      console.log("\n");
      console.log("***********************************");
      console.log("***********************************");
    }
  } else {
    log(
      "======================================================================",
    );
    log(
      `====================== [SKIPPED]: ${contractName} [${CONTRACTS.blackdust}] ==========================`,
    );
    log(
      "======================================================================",
    );
  }
};

func.tags = ["nft"];

module.exports = func;
