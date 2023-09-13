const { expect } = require("chai");

const hashWhitelistAccount = (account, saleId) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, saleId])
      .slice(2),
    "hex",
  );
};

describe("Black Dust NFT Contract Transfer", () => {
  let NFT;
  let nft;
  let BlackDustNFT;
  let blackdustNft;

  let provider;

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
      maxPerWallet: 5,
      maxPerTransaction: 5,
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
    const amount = 5;
    const cost = (costPerUnitAllowList * amount).toFixed(3);

    await nft
      .connect(addr1)
      .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
        value: ethers.utils.parseEther(cost.toString()),
      });

    await blackdustNft.addMinter(nft.address);
    await nft.setBlackdustContract(blackdustNft.address);
    await nft.toggleCanAwaken();

    await nft.connect(addr1).awakenMany([0, 2, 4, 3]);
  });

  describe("TotalSupply BlackDust NFT", () => {
    it("Should Fail: try to call internal update collectionsize function", async () => {
      try {
        await blackdustNft.connect(addr1)._setNewCollectionSize(5000);
      } catch (error) {
        expect(error.message).to.contain("is not a function");
      }
    });

    it("Should Fail: update max supply with non owner account", async () => {
      try {
        await blackdustNft.connect(addr1).setNewSupply(5000);
      } catch (error) {
        expect(error.message).to.contain("Ownable: caller is not the owner");
      }
    });

    it("Should PASS: update max supply should update collectionsize too", async () => {
      const collectionSize = await blackdustNft.collectionSize();
      expect(collectionSize).to.equal(10000);

      const totalSupplyCount = await blackdustNft.totalSupply();
      const totalBalance = await blackdustNft.balanceOf(addr1.address);

      expect(totalSupplyCount).to.equal(totalBalance);

      await blackdustNft.setNewSupply(5000);

      const collectionSizeAfter = await blackdustNft.collectionSize();
      expect(collectionSizeAfter).to.equal(5000);
    });
  });
});
