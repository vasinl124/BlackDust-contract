const { expect } = require("chai");

const PUBLIC_SALE_ID = 0;
const PUBLIC_RAFFLE_SALE_ID = 1;
const PRIVATE_SALE_ID = 2;
const ALLY_SALE_ID = 3;

const costPerUnitPublic = 0.25;
const costPerUnitAllowList = 0.15;

const royalty = 750;

const hashWhitelistAccount = (account, saleId) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, saleId])
      .slice(2),
    "hex",
  );
};

describe("Dev Wallet Contract", () => {
  let NFT;
  let nft;

  let provider;

  let privateSaleSignature;
  let devMultisig;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    const allySaleConfig = {
      saleId: ALLY_SALE_ID,
      maxPerWallet: 2,
      maxPerTransaction: 2,
      unitPrice: ethers.utils.parseEther(costPerUnitAllowList.toString()),
      signerAddress: owner.address,
      maxPerRound: 5000,
    };

    const privateSaleConfig = {
      saleId: PRIVATE_SALE_ID,
      maxPerWallet: 2,
      maxPerTransaction: 2,
      unitPrice: ethers.utils.parseEther(costPerUnitAllowList.toString()),
      signerAddress: owner.address,
      maxPerRound: 5000,
    };

    const publicRaffleSaleConfig = {
      saleId: PUBLIC_RAFFLE_SALE_ID,
      maxPerWallet: 2,
      maxPerTransaction: 2,
      unitPrice: ethers.utils.parseEther(costPerUnitPublic.toString()),
      signerAddress: owner.address,
      maxPerRound: 5,
    };

    const publicSaleConfig = {
      maxPerTransaction: 5,
      unitPrice: ethers.utils.parseEther(costPerUnitPublic.toString()),
    };

    NFT = await ethers.getContractFactory("Takrut");
    nft = await upgrades.deployProxy(
      NFT,
      [
        "Cilantro", // name
        "CIL", // symbol
        "https://gateway.pinata.cloud/ipfs/Qmego24DURSSuijn1iVwbpiVFQG9WXKnUkiV4SErJmHJAd/", // baseURI
        devMultisig, // devMultisig
        royalty,
        allySaleConfig,
        privateSaleConfig,
        publicRaffleSaleConfig,
        publicSaleConfig,
        owner.address,
      ],
      {
        initializer: "initialize",
      },
    );
    await nft.deployed();
    const addresses = {
      proxy: nft.address,
      admin: await upgrades.erc1967.getAdminAddress(nft.address),
      implementation: await upgrades.erc1967.getImplementationAddress(
        nft.address,
      ),
    };

    MoonToken = await ethers.getContractFactory("MoonToken");
    moonToken = await MoonToken.deploy(nft.address, addr2.address);

    privateSaleSignature = await owner.signMessage(
      hashWhitelistAccount(addr1.address, PRIVATE_SALE_ID),
    );
  });

  describe("Multisig Dev Wallet", () => {
    it("Withdraw to Multisig Dev Wallet should fail -> no ETH left", async () => {
      try {
        await nft.connect(addr3).withdrawETHBalanceToDev();
      } catch (error) {
        expect(error.message).to.contain("No ETH left");
      }
    });

    it("Get paid to contract and withdraw to Multisig Dev Wallet", async () => {
      await nft.setSaleStatus(PUBLIC_SALE_ID, true);

      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(2);

      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      expect(tx).to.be.an("object");

      const totalSupplyCount = await nft.totalSupply();
      const totalBalance = await nft.balanceOf(addr1.address);

      expect(totalSupplyCount).to.equal(amount);
      expect(totalBalance).to.equal(amount);

      let receipt = await tx.wait();

      const nftMinted = receipt.events?.filter((x) => {
        return x.event == "NFTMinted";
      });
      expect(nftMinted).to.length(1);

      for (
        let i = parseInt(
          ethers.utils.formatUnits(nftMinted[0].args.startTokenId),
          10,
        );
        i < amount;
        i++
      ) {
        const owner = await nft.connect(addr1).ownerOf(i);
        expect(owner).to.equal(addr1.address);
      }
      const nftETHBalance = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalance)).to.be.equal(
        cost.toString(),
      );

      await nft.connect(addr3).withdrawETHBalanceToDev();
      const nftETHBalanceAFTER = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalanceAFTER)).to.be.equal("0.0");

      const devMultisigETHBalance = await provider.getBalance(devMultisig);

      expect(ethers.utils.formatEther(devMultisigETHBalance)).to.be.equal(
        "9999.999588623881351631",
        // cost.toString(),
      );
    });

    it("set New Multisig Dev Wallet and withdraw to NEW Multisig Dev Wallet", async () => {
      const tx = await nft.connect(addr3).setDevMultiSigAddress(addr4.address);
      expect(tx).to.be.an("object");

      await nft.setSaleStatus(PUBLIC_SALE_ID, true);

      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(2);

      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      const nftETHBalance = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalance)).to.be.equal(
        cost.toString(),
      );

      await nft.connect(addr4).withdrawETHBalanceToDev();
      const nftETHBalanceAFTER = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalanceAFTER)).to.be.equal("0.0");

      const devMultisigETHBalance = await provider.getBalance(addr4.address);

      expect(ethers.utils.formatEther(devMultisigETHBalance)).to.be.equal(
        "10001.249657246126548152",
      );
    });

    it("withdraw token to Multisig Dev Wallet should fail -> no fund left", async () => {
      try {
        await nft.connect(addr3).withdrawTokensToDev(moonToken.address);
      } catch (error) {
        expect(error.message).to.contain("No token left");
      }
    });

    it("withdraw token to Multisig Dev Wallet should PASS", async () => {
      await moonToken.connect(addr2).setAllowedAddresses(owner.address, true);
      const totalTokenToMint = ethers.utils.parseEther("5000");
      await moonToken.claimLaboratoryExperimentRewards(
        nft.address,
        totalTokenToMint,
      );

      await nft.connect(addr3).withdrawTokensToDev(moonToken.address);

      const devMultisigTokenBalance = await moonToken.balanceOf(devMultisig);
      expect(devMultisigTokenBalance).to.be.equal(totalTokenToMint.toString());
    });
  });
});
