const { ethers, upgrades } = require("hardhat");
const {
  networkConfig,
  CONTRACTS,
  contratsToDeploy,
} = require("../utils/helper-hardhat-config");
const fs = require("fs");
const func = async ({ deployments, getChainId }) => {
  const blacklistOperatorFilterDeployment = await deployments.get(
    CONTRACTS.blacklistOperatorFilter,
  );
  const { log } = deployments;
  const chainId = await getChainId();

  const { takrut, devMultisigAddress } = networkConfig[chainId];
  const {
    contractName,
    contractSymbol,
    initBaseURI,
    royalty,
    allySaleConfig,
    privateSaleConfig,
    publicRaffleSaleConfig,
    publicSaleConfig,
    freeMintSignerAddress,
  } = takrut;

  if (contratsToDeploy.takrut.deploy) {
    log(
      "======================================================================",
    );
    log(
      `====================== NFT: ${contractName} [${CONTRACTS.nft}] ==========================`,
    );
    log(
      "======================================================================",
    );
    const NFT = await ethers.getContractFactory(CONTRACTS.nft);
    console.log("Deploying...");
    const nft = await upgrades.deployProxy(
      NFT,
      [
        contractName,
        contractSymbol,
        initBaseURI,
        devMultisigAddress, // dev multisig
        royalty,
        allySaleConfig,
        privateSaleConfig,
        publicRaffleSaleConfig,
        publicSaleConfig,
        freeMintSignerAddress,
      ],
      {
        initializer: "initialize",
      },
    );
    await nft.deployed();
    await nft.setOperatorFilter(blacklistOperatorFilterDeployment.address);

    const addresses = {
      proxy: nft.address,
      admin: await upgrades.erc1967.getAdminAddress(nft.address),
      implementation: await upgrades.erc1967.getImplementationAddress(
        nft.address,
      ),
    };
    console.log("Addresses:", addresses);

    const networkName = networkConfig[chainId]["name"];

    fs.writeFileSync(
      `${networkName}-deployment-takrut-addresses.json`,
      JSON.stringify(addresses, null, 2),
    );

    log("=====================================================");
    log(`You have deployed an NFT contract to "${nft.address}"`);
    log("=====================================================");

    if (contratsToDeploy.takrut.verify) {
      try {
        await run("verify:verify", {
          address: addresses.implementation,
          constructorArguments: [],
        });

        console.log("***********************************");
        console.log("***********************************");
        console.log("\n");
        console.log(`[Contract] ${CONTRACTS.nft} has been verify!`);
        console.log("\n");
        console.log("***********************************");
        console.log("***********************************");
      } catch (error) {}
    }
  } else {
    log(
      "======================================================================",
    );
    log(
      `====================== [SKIPPED]: ${contractName} [${CONTRACTS.nft}] ==========================`,
    );
    log(
      "======================================================================",
    );
  }
};

func.tags = ["nft"];
func.dependencies = [CONTRACTS.blacklistOperatorFilter];

module.exports = func;
