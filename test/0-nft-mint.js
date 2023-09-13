const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

const hashWhitelistAccount = (account, saleId) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, saleId])
      .slice(2),
    "hex",
  );
};

describe("NFT Contract", () => {
  let NFT;
  let nft;

  let privateSaleSignature;
  let publicRaffleSaleSignature;
  let devMultisig;

  const PUBLIC_SALE_ID = 0;
  const PUBLIC_RAFFLE_SALE_ID = 1;
  const PRIVATE_SALE_ID = 2;
  const ALLY_SALE_ID = 3;

  const costPerUnitPublic = 0.25;
  const costPerUnitAllowList = 0.15;

  const royalty = 750;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, _] = await ethers.getSigners();
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
      maxPerWallet: 5,
      maxPerTransaction: 5,
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

    ({ chainId } = await ethers.provider.getNetwork());

    privateSaleSignature = await owner.signMessage(
      hashWhitelistAccount(addr1.address, PRIVATE_SALE_ID),
    );

    publicRaffleSaleSignature = await owner.signMessage(
      hashWhitelistAccount(addr1.address, PUBLIC_RAFFLE_SALE_ID),
    );
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  describe("AllowlistMint", () => {
    it("AllowlistMint should fail -> NOT Active", async () => {
      try {
        const amount = 1;
        const cost = costPerUnitAllowList * amount;

        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("Sale not enabled");
      }
    });

    it("AllowlistMint should fail -> More than their max token purchase", async () => {
      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);
        const amount = 3; // Max per purchase is 1
        const cost = costPerUnitAllowList * amount;

        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("Exceeds max per transaction");
      }
    });

    it("AllowlistMint should fail -> use wrong saleId signature", async () => {
      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);
        const amount = 2;
        const cost = costPerUnitAllowList * amount;

        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, publicRaffleSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("Invalid signature");
      }
    });

    it("publicRaffleMint should fail -> More than publicRaffle max per round", async () => {
      try {
        await nft.setSaleStatus(PUBLIC_RAFFLE_SALE_ID, true);
        const amount = 4; // Max per purchase is 5
        const cost = costPerUnitPublic * amount;

        const publicRaffleSaleConfigBefore = await nft.getSaleConfig(
          PUBLIC_RAFFLE_SALE_ID,
        );

        expect(publicRaffleSaleConfigBefore.maxPerRound).to.equal(5);

        await nft
          .connect(addr1)
          .allowlistMint(
            PUBLIC_RAFFLE_SALE_ID,
            amount,
            publicRaffleSaleSignature,
            {
              value: ethers.utils.parseEther(cost.toString()),
            },
          );

        const publicRaffleSaleConfigAfter = await nft.getSaleConfig(
          PUBLIC_RAFFLE_SALE_ID,
        );

        expect(publicRaffleSaleConfigAfter.maxPerRound).to.equal(1);

        await nft
          .connect(addr2)
          .allowlistMint(
            PUBLIC_RAFFLE_SALE_ID,
            amount,
            publicRaffleSaleSignature,
            {
              value: ethers.utils.parseEther(cost.toString()),
            },
          );
      } catch (error) {
        expect(error.message).to.contain("Exceeds max per round");
      }
    });

    it("AllowlistMint should fail -> when try to mint more on the second transaction", async () => {
      await nft.setSaleStatus(PRIVATE_SALE_ID, true);

      const amount = 2;
      const cost = (costPerUnitAllowList * amount).toFixed(3);

      const amount2 = 1;
      const cost2 = (costPerUnitAllowList * amount2).toFixed(3);

      try {
        const [isWhitelistedBool, mintAmount] = await nft
          .connect(addr1)
          .isWhitelisted(PRIVATE_SALE_ID, privateSaleSignature);
        expect(isWhitelistedBool).to.equal(true);
        expect(mintAmount).to.equal(2);

        const [isWhitelistedBool11, mintAmount11] = await nft
          .connect(addr1)
          .isWhitelisted(PUBLIC_RAFFLE_SALE_ID, privateSaleSignature);
        expect(isWhitelistedBool11).to.equal(false);
        expect(mintAmount11).to.equal(0);

        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });

        const [isWhitelistedBool2, mintAmount2] = await nft
          .connect(addr1)
          .isWhitelisted(PRIVATE_SALE_ID, privateSaleSignature);
        expect(isWhitelistedBool2).to.equal(true);
        expect(mintAmount2).to.equal(0);

        const tx2 = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount2, privateSaleSignature, {
            value: ethers.utils.parseEther(cost2.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain(
          "Exceeds maximum tokens you can purchase in a single transaction",
        );
      }
    });

    it("AllowlistMint should fail -> Invalid signature", async () => {
      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);
        const amount = 2;
        const cost = costPerUnitAllowList * amount;

        const wrongSignature =
          "0x2626038312321008e1a40bbd29d836e084de950766bb04700c7d7800b6907ebb3df51e0fdf49e323aa4054ea8e3f4b35aeecba1b3f6564ff0893d1c8aff814231b";
        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, wrongSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("Invalid signature");
      }
    });

    it("AllowlistMint should fail -> LESS Supply", async () => {
      await nft.setSaleStatus(PRIVATE_SALE_ID, true);
      await nft.setNewSupply(0);

      const amount = 2;
      const cost = (costPerUnitAllowList * amount).toFixed(3);

      try {
        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("Exceeds max supply");
      }
    });

    it("Mint allowlistMint should fail -> send lower ETH than mint price -> Not enough ETH", async () => {
      await nft.setSaleStatus(PRIVATE_SALE_ID, true);

      const amount = 1;
      const cost = 0.24444; // 0.24444 ETH

      try {
        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("ETH amount is not sufficient");
      }
    });

    it("AllowlistMint should fail -> Not enough ETH", async () => {
      await nft.setSaleStatus(PRIVATE_SALE_ID, true);

      const amount = 2;
      const cost = 0;

      try {
        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("ETH amount is not sufficient");
      }
    });

    it("AllowlistMint should fail -> cost = null -> Not enough ETH", async () => {
      await nft.setSaleStatus(PRIVATE_SALE_ID, true);

      const amount = 2;

      try {
        const tx = await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: null,
          });
      } catch (error) {
        expect(error.message).to.contain("ETH amount is not sufficient");
      }
    });

    it("AllowlistMint should ALL PASS", async () => {
      await nft.setSaleStatus(PRIVATE_SALE_ID, true);
      const amount = 2;
      const cost = (costPerUnitAllowList * amount).toFixed(3);

      const tx = await nft
        .connect(addr1)
        .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      expect(tx).to.be.an("object");

      let receipt = await tx.wait();

      const totalSupplyCount = await nft.totalSupply();
      const totalBalance = await nft.balanceOf(addr1.address);

      const ownedTokenIds = await nft.walletOfOwner(addr1.address);

      expect(ownedTokenIds.length).to.equal(2);
      expect(totalSupplyCount).to.equal(totalBalance);

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
    });
  });

  describe("Mint Public", () => {
    it("PublicMint should fail -> NOT Active", async () => {
      try {
        const amount = 1;
        const cost = (costPerUnitPublic * amount).toFixed(3);
        const tx = await nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
      } catch (error) {
        expect(error.message).to.contain("Sale not enabled");
      }
    });

    it("PublicMint should fail -> More than MAX_PER_PURCHASE", async () => {
      try {
        await nft.setSaleStatus(PUBLIC_SALE_ID, true);
        const amount = 6; // Max per purchase is 5
        const cost = (costPerUnitPublic * amount).toFixed(3);
        const tx = await nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
      } catch (error) {
        expect(error.message).to.contain("Exceeds max per transaction");
      }
    });

    it("PublicMint should ALL PASS", async () => {
      await nft.setSaleStatus(PUBLIC_SALE_ID, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      expect(tx).to.be.an("object");

      let receipt = await tx.wait();

      const totalSupplyCount = await nft.totalSupply();
      const totalBalance = await nft.balanceOf(addr1.address);

      expect(totalSupplyCount).to.equal(totalBalance);

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
    });
  });

  describe("DevMint Reserve NFTs", () => {
    it("DevMint Reserve NFTs", async () => {
      const amount = 50;

      const DEV_RESERVE_BEFORE = await nft.DEV_RESERVE();
      expect(DEV_RESERVE_BEFORE).to.be.equal(250);
      await nft.connect(owner).devMint(amount);
      await nft.connect(owner).devMint(amount);
      await nft.connect(owner).devMint(amount);
      await nft.connect(owner).devMint(amount);

      const DEV_RESERVE_AFTER = await nft.DEV_RESERVE();
      expect(DEV_RESERVE_AFTER).to.be.equal(50);

      const totalSupplyCount = await nft.totalSupply();
      const totalBalance = await nft.balanceOf(devMultisig);
      expect(totalSupplyCount).to.equal(200);
      expect(totalBalance).to.equal(200);
    });
  });

  describe("Mint Unknown Sale Id", () => {
    it("Unknown SaleId Mint should fail", async () => {
      try {
        const amount = 1;
        const cost = costPerUnitAllowList * amount;

        const tx = await nft
          .connect(addr1)
          .allowlistMint(200, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("Sale not enabled");
      }
    });
  });

  describe("Mint more than supply", () => {
    it("AllowlistMint more than supply should fail", async () => {
      await nft.setSaleStatus(PRIVATE_SALE_ID, true);

      const newPrice = 0.01;
      await nft.setSaleConfig(
        PRIVATE_SALE_ID,
        4,
        4,
        ethers.utils.parseEther(newPrice.toString()),
        owner.address,
        5000,
      );

      const amount = 2;
      const cost = (costPerUnitAllowList * amount).toFixed(3);

      expect(await nft.connect(addr1).MAX_SUPPLY()).to.be.equal(10000);

      await nft
        .connect(addr1)
        .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      await nft.setNewSupply(4);

      expect(await nft.connect(addr1).MAX_SUPPLY()).to.be.equal(4);

      const newCost = (newPrice * amount).toFixed(3);

      await nft
        .connect(addr1)
        .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(newCost.toString()),
        });

      try {
        await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(newCost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("Exceeds max supply");
      }
    });

    it("PublicMint more than supply should fail", async () => {
      await nft.setSaleStatus(PUBLIC_SALE_ID, true);

      expect(await nft.connect(addr1).MAX_SUPPLY()).to.be.equal(10000);

      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await nft.setNewSupply(9);

      expect(await nft.connect(addr1).MAX_SUPPLY()).to.be.equal(9);

      try {
        await nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
      } catch (error) {
        expect(error.message).to.contain("Exceeds max supply");
      }

      expect(await nft.connect(addr1).totalSupply()).to.be.equal(5);
    });
  });
});
