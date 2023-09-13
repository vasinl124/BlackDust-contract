const { expect } = require("chai");
const { network } = require("hardhat");

const hashWhitelistAccount = (account, saleId) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, saleId])
      .slice(2),
    "hex",
  );
};

describe("NFT Contract Locking", () => {
  let NFT;
  let nft;
  let BlackDustNFT;
  let blackdustNft;

  let provider;
  let chainId;

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

    await nft.setSaleStatus(PRIVATE_SALE_ID, true);
    const amount = 3;
    const cost = (costPerUnitAllowList * amount).toFixed(3);

    await nft
      .connect(addr1)
      .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
        value: ethers.utils.parseEther(cost.toString()),
      });

    await blackdustNft.addMinter(nft.address);
    await nft.setBlackdustContract(blackdustNft.address);
    await nft.toggleCanAwaken();

    await nft.connect(addr1).awakenMany([0, 2]);
  });

  describe("Locking NFT", () => {
    it("Lock NFT shoud fail -> Locking is not started yet", async () => {
      try {
        await blackdustNft.connect(addr1).toggleLocking([0]);
      } catch (error) {
        expect(error.message).to.contain("Locking closed");
      }
    });

    it("Lock NFT shoud fail -> not owner try to open locking status", async () => {
      try {
        await blackdustNft.connect(addr1).setLockingOpen(true);
      } catch (error) {
        expect(error.message).to.contain("Ownable: caller is not the owner");
      }
    });

    it("Lock NFT shoud fail -> when lock and try to transfer to another wallet", async () => {
      await blackdustNft.setLockingOpen(true);

      try {
        const nft1Id = 0;
        await blackdustNft.connect(addr1).toggleLocking([nft1Id]);

        const from = addr1.address;
        const to = addr2.address;

        await blackdustNft
          .connect(addr1)
          ["safeTransferFrom(address,address,uint256)"](from, to, nft1Id);
      } catch (error) {
        expect(error.message).to.contain("Locking");
      }
    });

    it("Lock NFT shoud pass -> locking and see current move up", async () => {
      await blackdustNft.setLockingOpen(true);

      const nft1Id = 0;
      await blackdustNft.connect(addr1).toggleLocking([nft1Id]);

      const from = addr1.address;
      const to = addr2.address;

      const [locking, current, total] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      await network.provider.send("evm_increaseTime", [86400]); // wait 1 day
      await network.provider.send("evm_mine");

      const [locking2, current2, total2] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(locking2).to.be.equal(true);
      expect(current2).to.be.equal(86400);
      expect(total2).to.be.equal(86400);
    });

    it("Lock NFT shoud pass -> locking and unlocking should see current reset to 0", async () => {
      await blackdustNft.setLockingOpen(true);

      const nft1Id = 0;
      await blackdustNft.connect(addr1).toggleLocking([nft1Id]);

      const from = addr1.address;
      const to = addr2.address;

      const [locking, current, total] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      await network.provider.send("evm_increaseTime", [86400]); // wait 1 day
      await network.provider.send("evm_mine");

      const [locking2, current2, total2] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(locking2).to.be.equal(true);
      expect(current2).to.be.equal(86400);
      expect(total2).to.be.equal(86400);

      await blackdustNft.connect(addr1).toggleLocking([nft1Id]);

      const [locking3, current3, total3] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(locking3).to.be.equal(false);
      expect(current3).to.be.equal(0);
      expect(total3).to.be.equal(86401);
    });

    it("Lock NFT shoud fail -> when trying to toggleLocking not owned one", async () => {
      await blackdustNft.setLockingOpen(true);

      const randomTokenId = 3;

      const privateSaleSignature2 = await owner.signMessage(
        hashWhitelistAccount(addr2.address, PRIVATE_SALE_ID),
      );

      const amount = 2;
      const cost = (costPerUnitAllowList * amount).toFixed(3);

      await nft
        .connect(addr2)
        .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature2, {
          value: ethers.utils.parseEther(cost.toString()),
        });
      await nft.connect(addr2).awakenMany([randomTokenId, 4]);

      try {
        await blackdustNft.connect(addr1).toggleLocking([randomTokenId]);
      } catch (error) {
        expect(error.message).to.contain("NOT_AUTHORIZED");
      }
    });

    it("Lock NFT shoud fail -> when trying to toggleLocking not exist token", async () => {
      await blackdustNft.setLockingOpen(true);
      const randomTokenId = 3345;

      try {
        await blackdustNft.connect(addr1).toggleLocking([randomTokenId]);
      } catch (error) {
        // expect(error.message).to.contain("OwnerQueryForNonexistentToken()");
        expect(error.message).to.contain("ERC721: invalid token ID");
      }
    });

    it("Lock NFT shoud fail -> when lock and non-expeller try to expell", async () => {
      await blackdustNft.setLockingOpen(true);
      const randomTokenId = 0;

      try {
        await blackdustNft.connect(addr1).toggleLocking([randomTokenId]);

        await blackdustNft.connect(addr2).expelFromLock(randomTokenId);
      } catch (error) {
        expect(error.message).to.contain("ONLY_EXPELLER");
      }
    });

    it("Lock NFT shoud PASS -> when lock and expeller try to expell", async () => {
      await blackdustNft.setLockingOpen(true);
      const nft1Id = 0;

      await blackdustNft.connect(addr1).toggleLocking([nft1Id]);

      const [lockingBefore, currentBefore, totalBefore] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(lockingBefore).to.be.equal(true);
      expect(currentBefore).to.be.equal(0);
      expect(totalBefore).to.be.equal(0);

      await network.provider.send("evm_increaseTime", [86400]); // wait 1 day
      await network.provider.send("evm_mine");

      await blackdustNft.connect(owner).expelFromLock(nft1Id);

      const [lockingAfter, currentAfter, totalAfter] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(lockingAfter).to.be.equal(false);
      expect(currentAfter).to.be.equal(0);
      expect(totalAfter).to.be.equal(86401);
    });

    it("Lock NFT shoud fail -> non-owner try to transfer while locking", async () => {
      await blackdustNft.setLockingOpen(true);
      const nft1Id = 0;

      await blackdustNft.connect(addr1).toggleLocking([nft1Id]);

      const [lockingBefore, currentBefore, totalBefore] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(lockingBefore).to.be.equal(true);
      expect(currentBefore).to.be.equal(0);
      expect(totalBefore).to.be.equal(0);

      const firstOwner = await blackdustNft.connect(addr1).ownerOf(nft1Id);
      expect(firstOwner).to.be.equal(addr1.address);

      try {
        await blackdustNft
          .connect(addr2)
          .safeTransferWhileLocking(addr1.address, addr2.address, nft1Id);
      } catch (error) {
        expect(error.message).to.contain("Only owner");
      }
    });

    it("Lock NFT shoud PASS -> transfer while locking", async () => {
      await blackdustNft.setLockingOpen(true);
      const nft1Id = 0;

      await blackdustNft.connect(addr1).toggleLocking([nft1Id]);

      const [lockingBefore, currentBefore, totalBefore] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(lockingBefore).to.be.equal(true);
      expect(currentBefore).to.be.equal(0);
      expect(totalBefore).to.be.equal(0);

      const firstOwner = await blackdustNft.connect(addr1).ownerOf(nft1Id);
      expect(firstOwner).to.be.equal(addr1.address);

      await network.provider.send("evm_increaseTime", [86400]); // wait 1 day
      await network.provider.send("evm_mine");

      await blackdustNft
        .connect(addr1)
        .safeTransferWhileLocking(addr1.address, addr2.address, nft1Id);

      const [lockingAfter, currentAfter, totalAfter] = await blackdustNft
        .connect(addr1)
        .lockingPeriod(nft1Id);

      expect(lockingAfter).to.be.equal(true);
      expect(currentAfter).to.be.equal(86401);
      expect(totalAfter).to.be.equal(86401);

      const newOwner = await blackdustNft.connect(addr1).ownerOf(nft1Id);
      expect(newOwner).to.be.equal(addr2.address);
    });
  });
});
