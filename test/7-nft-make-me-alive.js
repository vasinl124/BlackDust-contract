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
  let BlackDustNFT;
  let blackdustNft;

  let privateSaleSignature;
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
      maxPerWallet: 3,
      maxPerTransaction: 3,
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

    BlackDustNFT = await ethers.getContractFactory("BlackDust");
    blackdustNft = await upgrades.deployProxy(
      BlackDustNFT,
      [
        "RealBlackPepper", // name
        "BPP", // symbol
        "https://gateway.pinata.cloud/ipfs/Qmego24DURSSuijn1iVwbpiVFQG9WXKnUkiV4SErJmHJAd/", // baseURI
        devMultisig, // devMultisig
        royalty,
      ],
      {
        initializer: "initialize",
      },
    );
    await blackdustNft.deployed();

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
  });

  describe("Make Me Alive", () => {
    it("toggleCanAwaken should fail -> Not Owner try to call this", async () => {
      try {
        await nft.connect(addr2).toggleCanAwaken();
      } catch (error) {
        expect(error.message).to.contain("caller is not the owner");
      }
    });

    it("toggleCanAwaken should fail -> Blackdust contract is not specified yet", async () => {
      try {
        await nft.toggleCanAwaken();
      } catch (error) {
        expect(error.message).to.contain("BlackdustFactoryNotOpenYet");
      }
    });

    it("setBlackdustContract should fail -> Not Owner try to call this", async () => {
      try {
        await nft
          .connect(addr2)
          .setBlackdustContract("0x64ad353bc90a04361c4810ae7b3701f3beb48d7e");
      } catch (error) {
        expect(error.message).to.contain("caller is not the owner");
      }
    });

    it("setBlackdustContract should pass", async () => {
      await nft.setBlackdustContract(blackdustNft.address);
    });

    it("toggleCanAwaken should pass -> Blackdust contract is specified and owner call", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await nft.canAwaken()).to.equal(true);
    });

    it("awaken 1 takrut should fail -> AwakenIsClosed", async () => {
      expect(await nft.canAwaken()).to.equal(false);

      try {
        await nft.connect(addr1).awaken(20);
      } catch (error) {
        expect(error.message).to.contain("AwakenIsClosed");
      }
    });

    it("canAwaken 1 takrut should fail -> OwnerQueryForNonexistentToken", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.connect(addr1).awaken(20);
      } catch (error) {
        expect(error.message).to.contain("OwnerQueryForNonexistentToken");
      }
    });

    it("canAwaken 1 takrut should fail -> CannotAwakenWithUnownedTakrut", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);

        const amount = 1;
        const cost = (costPerUnitAllowList * amount).toFixed(3);

        await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });

        await nft.connect(addr2).awaken(0);
      } catch (error) {
        expect(error.message).to.contain("CannotAwakenWithUnownedTakrut");
      }
    });

    it("awakenMany should fail -> OwnerQueryForNonexistentToken", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.connect(addr1).awakenMany([20, 2, 399]);
      } catch (error) {
        expect(error.message).to.contain("OwnerQueryForNonexistentToken");
      }
    });

    it("awakenMany should fail -> CannotAwakenWithUnownedTakrut", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);

        const amount = 1;
        const cost = (costPerUnitAllowList * amount).toFixed(3);

        await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });

        await nft.connect(addr2).awakenMany([0, 30, 399]);
      } catch (error) {
        expect(error.message).to.contain("CannotAwakenWithUnownedTakrut");
      }
    });

    it("makeMeAlive 1 takrut should fail -> no minter address set on blackdust contract yet", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);

        const amount = 1;
        const cost = (costPerUnitAllowList * amount).toFixed(3);

        await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });

        await nft.connect(addr1).awaken(0);
      } catch (error) {
        expect(error.message).to.contain(
          "Transaction reverted without a reason string",
        );
      }
    });

    it("makeMeAlive 1 takrut should pass", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await blackdustNft.minters(nft.address)).to.equal(false);
      await blackdustNft.addMinter(nft.address);
      expect(await blackdustNft.minters(nft.address)).to.equal(true);

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);

        const amount = 1;
        const cost = (costPerUnitAllowList * amount).toFixed(3);

        await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });

        const takrutTotalSupplyBeforeBurn = await nft
          .connect(addr1)
          .totalSupply();

        expect(takrutTotalSupplyBeforeBurn).to.equal(1);

        const blackdustNftTotalSupplyBeforeMint = await blackdustNft
          .connect(addr1)
          .totalSupply();

        expect(blackdustNftTotalSupplyBeforeMint).to.equal(0);

        await nft.connect(addr1).awaken(0);

        const takrutTotalSupplyAfterBurn = await nft
          .connect(addr1)
          .totalSupply();

        expect(takrutTotalSupplyAfterBurn).to.equal(0);

        const blackdustNftTotalSupplyAfterMint = await blackdustNft
          .connect(addr1)
          .totalSupply();

        expect(blackdustNftTotalSupplyAfterMint).to.equal(1);

        const blackdustNftOwnerAddress = await blackdustNft.ownerOf(0);
        expect(blackdustNftOwnerAddress).to.equal(addr1.address);
      } catch (error) {
        expect(error.message).to.contain(
          "Transaction reverted without a reason string",
        );
      }
    });

    it("awakenMany should fail -> no minter address set on blackdust contract yet", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);

        const amount = 3;
        const cost = (costPerUnitAllowList * amount).toFixed(3);

        await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });

        await nft.connect(addr1).awakenMany([0]);
      } catch (error) {
        expect(error.message).to.contain(
          "Transaction reverted without a reason string",
        );
      }
    });

    it("awakenMany should pass", async () => {
      expect(await nft.canAwaken()).to.equal(false);
      await nft.setBlackdustContract(blackdustNft.address);
      await nft.toggleCanAwaken();

      expect(await blackdustNft.minters(nft.address)).to.equal(false);
      await blackdustNft.addMinter(nft.address);
      expect(await blackdustNft.minters(nft.address)).to.equal(true);

      expect(await nft.canAwaken()).to.equal(true);

      try {
        await nft.setSaleStatus(PRIVATE_SALE_ID, true);

        const amount = 3;
        const cost = (costPerUnitAllowList * amount).toFixed(3);

        await nft
          .connect(addr1)
          .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          });

        const takrutTotalSupplyBeforeBurn = await nft
          .connect(addr1)
          .totalSupply();

        expect(takrutTotalSupplyBeforeBurn).to.equal(3);

        const blackdustNftTotalSupplyBeforeMint = await blackdustNft
          .connect(addr1)
          .totalSupply();

        expect(blackdustNftTotalSupplyBeforeMint).to.equal(0);

        await nft.connect(addr1).awakenMany([2, 1]);

        const takrutTotalSupplyAfterBurn = await nft
          .connect(addr1)
          .totalSupply();

        expect(takrutTotalSupplyAfterBurn).to.equal(1);

        const blackdustNftTotalSupplyAfterMint = await blackdustNft
          .connect(addr1)
          .totalSupply();

        expect(blackdustNftTotalSupplyAfterMint).to.equal(2);

        const blackdustNftOwnerAddress = await blackdustNft.ownerOf(1);
        expect(blackdustNftOwnerAddress).to.equal(addr1.address);
      } catch (error) {
        expect(error.message).to.contain(
          "Transaction reverted without a reason string",
        );
      }
    });
  });
});
