const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

const hashAccount = (account, secretCode) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, secretCode])
      .slice(2),
    "hex",
  );
};

describe("NFT Contract", () => {
  let NFT;
  let nft;

  let devMultisig;

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

    ({ chainId } = await ethers.provider.getNetwork());
  });

  describe("FreeMint", () => {
    it("FreeMint should fail --> not enabled", async () => {
      const secretCode = ethers.utils.formatBytes32String(
        "SOMETHING_OXOOOXOXXO",
      );

      freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, secretCode),
      );

      try {
        await nft.connect(addr1).freeMint(secretCode, freeMintSignature);
      } catch (error) {
        expect(error.message).to.be.contain("FreeMintNotEnabled");
      }
    });

    it("FreeMint should pass", async () => {
      await nft.toggleFreeMintEnabled();

      const secretCode = ethers.utils.formatBytes32String(
        "SOMETHING_OXOOOXOXXO",
      );

      freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, secretCode),
      );

      await nft.connect(addr1).freeMint(secretCode, freeMintSignature);

      const addr1Balance = await nft.connect(addr1).balanceOf(addr1.address);
      expect(addr1Balance).to.equal(1);
      expect(await nft.connect(addr1).MAX_FREE_SUPPLY()).to.equal(49);
    });

    it("FreeMint should fail -> Invalid signature", async () => {
      await nft.toggleFreeMintEnabled();

      try {
        const secretCode = ethers.utils.formatBytes32String(
          "SOMETHING_OXOOOXOXXO",
        );

        const secretCode2 = ethers.utils.formatBytes32String(
          "SOMETHING_OXOOOXOXXO2222",
        );

        freeMintSignature = await owner.signMessage(
          hashAccount(addr1.address, secretCode),
        );

        await nft.connect(addr1).freeMint(secretCode2, freeMintSignature);
      } catch (error) {
        expect(error.message).to.contain("Invalid signature");
      }
    });

    it("FreeMint should fail -> try to claim twice", async () => {
      await nft.toggleFreeMintEnabled();

      const secretCode = ethers.utils.formatBytes32String(
        "SOMETHING_OXOOOXOXXO",
      );

      freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, secretCode),
      );

      await nft.connect(addr1).freeMint(secretCode, freeMintSignature);

      const addr1Balance = await nft.connect(addr1).balanceOf(addr1.address);
      expect(addr1Balance).to.equal(1);

      try {
        await nft.connect(addr1).freeMint(secretCode, freeMintSignature);
      } catch (error) {
        expect(error.message).to.contain("Secret Code already used");
      }
    });

    it("FreeMint should fail -> only 1 nft per wallet!", async () => {
      await nft.toggleFreeMintEnabled();

      const secretCode = ethers.utils.formatBytes32String(
        "SOMETHING_OXOOOXOXXO",
      );

      const secretCode2 = ethers.utils.formatBytes32String(
        "SOMETHING_OXOOOXOXXO22222",
      );

      freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, secretCode),
      );

      freeMintSignature2 = await owner.signMessage(
        hashAccount(addr1.address, secretCode2),
      );

      await nft.connect(addr1).freeMint(secretCode, freeMintSignature);

      const addr1Balance = await nft.connect(addr1).balanceOf(addr1.address);
      expect(addr1Balance).to.equal(1);

      try {
        await nft.connect(addr1).freeMint(secretCode2, freeMintSignature2);
      } catch (error) {
        expect(error.message).to.contain("Only one nft per wallet");
      }
    });

    it("FreeMint should fail -> max token claimed", async () => {
      await nft.toggleFreeMintEnabled();
      await nft.setNewMaxFreeSupply(10);

      for (let i = 0; i <= 10; i++) {
        const secretCode = ethers.utils.formatBytes32String(
          `SOMETHING_OXOOOXOXXO_${i}`,
        );

        const minter = (await ethers.getSigners())[i];

        freeMintSignature = await owner.signMessage(
          hashAccount(minter.address, secretCode),
        );

        try {
          await nft.connect(minter).freeMint(secretCode, freeMintSignature);
          const minterBalance = await nft
            .connect(minter)
            .balanceOf(minter.address);
          expect(minterBalance).to.equal(1);
        } catch (error) {
          expect(error.message).to.contain("All free mint has been claimed!");
        }
      }
    });
  });
});
