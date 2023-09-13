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

    ({ chainId } = await ethers.provider.getNetwork());

    privateSaleSignature = await owner.signMessage(
      hashWhitelistAccount(addr1.address, PRIVATE_SALE_ID),
    );
  });

  describe("Refund Mint", () => {
    it("Toggle RefundConfig should fail -> Not Owner try to call this", async () => {
      try {
        const refundConfig = {
          enabled: true,
          vault: owner.address,
        };

        await nft.connect(addr2).setRefundConfig(refundConfig);
      } catch (error) {
        expect(error.message).to.contain("caller is not the owner");

        const isRefundEnabled = await nft.isRefundEnabled();
        expect(isRefundEnabled).to.equal(false);
      }
    });

    it("Refund should fail -> refund not active", async () => {
      try {
        await nft.setSaleStatus(PUBLIC_SALE_ID, true);
        const amount = 5;
        const cost = (costPerUnitPublic * amount).toFixed(3);
        const tx = await nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
        expect(tx).to.be.an("object");

        await nft.connect(addr1).refund(1);
      } catch (error) {
        expect(error.message).to.contain("RefundNotEnabled");
      }
    });

    it("Refund should fail -> Only Minter Can Refund", async () => {
      try {
        await nft.setSaleStatus(PUBLIC_SALE_ID, true);
        const amount = 5;
        const cost = (costPerUnitPublic * amount).toFixed(3);
        const tx = await nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
        expect(tx).to.be.an("object");

        const refundConfig = {
          enabled: true,
          vault: owner.address,
        };

        await nft.setRefundConfig(refundConfig);
        const isRefundEnabled = await nft.isRefundEnabled();
        expect(isRefundEnabled).to.equal(true);

        await nft.connect(addr2).refund(1);
      } catch (error) {
        expect(error.message).to.contain("OnlyMinterCanRefund");
      }
    });

    it("Refund should fail -> Random TokenID -> Only Minter Can Refund", async () => {
      try {
        await nft.setSaleStatus(PUBLIC_SALE_ID, true);
        const amount = 5;
        const cost = (costPerUnitPublic * amount).toFixed(3);
        const tx = await nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
        expect(tx).to.be.an("object");

        const refundConfig = {
          enabled: true,
          vault: owner.address,
        };

        await nft.setRefundConfig(refundConfig);
        const isRefundEnabled = await nft.isRefundEnabled();
        expect(isRefundEnabled).to.equal(true);

        await nft.connect(addr1).refund(10);
      } catch (error) {
        expect(error.message).to.contain("OnlyMinterCanRefund");
      }
    });

    it("Refund should pass - Public Mint", async () => {
      await nft.setSaleStatus(PUBLIC_SALE_ID, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      expect(tx).to.be.an("object");

      const tokenId = 1;
      const refundConfig = {
        enabled: true,
        vault: owner.address,
      };

      await nft.setRefundConfig(refundConfig);
      const isRefundEnabled = await nft.isRefundEnabled();
      expect(isRefundEnabled).to.equal(true);

      const balance = await provider.getBalance(nft.address);
      expect(balance).to.equal("1250000000000000000");

      const ownerAddress = await nft.connect(addr1).ownerOf(tokenId);
      expect(ownerAddress).to.equal(addr1.address);

      await nft.connect(addr1).refund(tokenId);

      const newOwnerAddress = await nft.connect(addr1).ownerOf(tokenId);
      expect(newOwnerAddress).to.equal(owner.address);

      const balanceAfter = await provider.getBalance(nft.address);
      expect(balanceAfter).to.equal("1000000000000000000");
    });

    it("Refund should fail - Public Mint but try to refund after the refund period ends", async () => {
      await nft.setSaleStatus(PUBLIC_SALE_ID, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      expect(tx).to.be.an("object");

      const tokenId = 1;
      const refundConfig = {
        enabled: true,
        vault: owner.address,
      };

      await nft.setRefundConfig(refundConfig);
      const isRefundEnabled = await nft.isRefundEnabled();
      expect(isRefundEnabled).to.equal(true);

      const balance = await provider.getBalance(nft.address);
      expect(balance).to.equal("1250000000000000000");

      const ownerAddress = await nft.connect(addr1).ownerOf(tokenId);
      expect(ownerAddress).to.equal(addr1.address);

      await nft.connect(addr1).refund(tokenId);

      const newOwnerAddress = await nft.connect(addr1).ownerOf(tokenId);
      expect(newOwnerAddress).to.equal(owner.address);

      const balanceAfter = await provider.getBalance(nft.address);
      expect(balanceAfter).to.equal("1000000000000000000");

      const tokenId2 = 2;
      const refundConfig2 = {
        enabled: false,
        vault: owner.address,
      };

      await nft.setRefundConfig(refundConfig2);

      try {
        await nft.connect(addr1).refund(tokenId2);
      } catch (error) {
        expect(error.message).to.contain("RefundNotEnabled");
      }
    });

    it("Refund should pass - AllowlistMint", async () => {
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

      ownedTokenIds.map(async (tokenId) => {
        const mintedToken = await nft._mintedToken(tokenId);
        expect(mintedToken.minter).to.equal(addr1.address);
        expect(
          ethers.utils.formatEther(mintedToken.mintPrice.toString()),
        ).to.equal(costPerUnitAllowList.toString());
      });

      const refundConfig = {
        enabled: true,
        vault: owner.address,
      };

      await nft.setRefundConfig(refundConfig);
      const isRefundEnabled = await nft.isRefundEnabled();
      expect(isRefundEnabled).to.equal(true);

      const balance = await provider.getBalance(nft.address);
      expect(balance).to.equal("300000000000000000");

      const tokenId = 1;

      const ownerAddress = await nft.connect(addr1).ownerOf(tokenId);
      expect(ownerAddress).to.equal(addr1.address);

      await nft.connect(addr1).refund(tokenId);

      const balanceAfter = await provider.getBalance(nft.address);
      expect(balanceAfter).to.equal("150000000000000000");

      const newOwnerAddress = await nft.connect(addr1).ownerOf(tokenId);
      expect(newOwnerAddress).to.equal(owner.address);

      expect(ownedTokenIds.length).to.equal(2);
      expect(totalSupplyCount).to.equal(totalBalance);
    });

    it("FreeMint then try to make a refund should FAIL", async () => {
      await nft.toggleFreeMintEnabled();

      const secretCode = ethers.utils.formatBytes32String(
        "SOMETHING_OXOOOXOXXO",
      );

      freeMintSignature = await owner.signMessage(
        hashWhitelistAccount(addr1.address, secretCode),
      );

      await nft.connect(addr1).freeMint(secretCode, freeMintSignature);

      const addr1Balance = await nft.connect(addr1).balanceOf(addr1.address);
      expect(addr1Balance).to.equal(1);
      expect(await nft.connect(addr1).MAX_FREE_SUPPLY()).to.equal(49);

      const refundConfig = {
        enabled: true,
        vault: owner.address,
      };

      await nft.setRefundConfig(refundConfig);
      const isRefundEnabled = await nft.isRefundEnabled();
      expect(isRefundEnabled).to.equal(true);

      const tokenIds = await nft.walletOfOwner(addr1.address);

      try {
        await nft.connect(addr1).refund(tokenIds[0]);
      } catch (error) {
        expect(error.message).to.contain("OnlyMinterCanRefund");
      }
    });
  });
});
