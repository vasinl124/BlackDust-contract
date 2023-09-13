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

  describe("Whitelist", () => {
    it("Whitelist user first time checking  -> should show isWhitelisted: true and 2 mintAmount", async () => {
      const [isWhitelistedBool, mintAmount] = await nft
        .connect(addr1)
        .isWhitelisted(PRIVATE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedBool).to.be.equal(true);
      expect(mintAmount).to.be.equal(2);
    });

    it("mint 1 and should show mintAmount down to 1", async () => {
      const [isWhitelistedBool, mintAmount] = await nft
        .connect(addr1)
        .isWhitelisted(PRIVATE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedBool).to.be.equal(true);
      expect(mintAmount).to.be.equal(2);

      await nft.setSaleStatus(PRIVATE_SALE_ID, true);

      const amount = 1;
      const cost = (costPerUnitAllowList * amount).toFixed(3);

      await nft
        .connect(addr1)
        .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      const { maxPerRound } = await nft.getSaleConfig(PRIVATE_SALE_ID);
      expect(maxPerRound).to.be.equal(4999);

      const [isWhitelistedAfter, mintAmountAfter] = await nft
        .connect(addr1)
        .isWhitelisted(PRIVATE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedAfter).to.be.equal(true);
      expect(mintAmountAfter).to.be.equal(1);
    });
  });
});
