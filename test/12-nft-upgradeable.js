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

    privateSaleSignature = await owner.signMessage(
      hashAccount(addr1.address, PRIVATE_SALE_ID),
    );
  });

  describe("Upgrade Contract", () => {
    it("Upgrade Contract should still have existing value", async () => {
      await nft.toggleFreeMintEnabled();

      const secretCode = ethers.utils.formatBytes32String(
        "SOMETHING_OXOOOXOXXO",
      );

      freeMintSignature = await owner.signMessage(
        hashAccount(addr2.address, secretCode),
      );

      await nft.connect(addr2).freeMint(secretCode, freeMintSignature);

      const addr2Balance = await nft.connect(addr2).balanceOf(addr2.address);
      expect(addr2Balance).to.equal(1);
      expect(await nft.connect(addr2).MAX_FREE_SUPPLY()).to.equal(49);

      await nft.setSaleStatus(PUBLIC_SALE_ID, true);
      const publicCost = costPerUnitPublic * 5;
      const publicTx = await nft.connect(addr3).publicMint(5, {
        value: ethers.utils.parseEther(publicCost.toString()),
      });

      const NFTV2 = await ethers.getContractFactory("TakrutV2");
      const nftV2 = await upgrades.upgradeProxy(nft.address, NFTV2);

      expect(nft.address).to.equal(nftV2.address);

      const V2newUpdateValue = await nftV2.connect(addr1).newUpdate();
      expect(V2newUpdateValue).to.equal("updateee");

      const awakenNewUpdateV2 = await nftV2.connect(addr1).awakenNewUpdate();
      expect(awakenNewUpdateV2).to.equal("awakenNewUpdate__");

      await nftV2.setSaleStatus(PRIVATE_SALE_ID, true);

      const amount = 2; // Max per purchase is 1
      const cost = costPerUnitAllowList * amount;

      console.log(
        "V2: totalSupply()->",
        (await nftV2.connect(addr1).totalSupply()).toString(),
      );

      const tx = await nftV2
        .connect(addr1)
        .allowlistMint(PRIVATE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      expect(tx).to.be.an("object");

      let receipt = await tx.wait();

      const totalSupplyCount = await nftV2.totalSupply();
      const totalBalance = await nftV2.balanceOf(addr1.address);
      const ownedTokenIds = await nftV2.walletOfOwner(addr1.address);

      expect(totalSupplyCount).to.equal(8);
      expect(totalBalance).to.equal(2);
      expect(ownedTokenIds.length).to.equal(2);

      const nftMinted = receipt.events?.filter((x) => {
        return x.event == "NFTMinted";
      });

      expect(nftMinted).to.length(1);

      const startTokenId = parseInt(
        ethers.utils.formatUnits(nftMinted[0].args.startTokenId, 0),
        10,
      );

      const owner1 = await nft.connect(addr1).ownerOf(startTokenId);
      expect(owner1).to.equal(addr1.address);

      expect((await nftV2.walletOfOwner(addr1.address)).length).to.equal(2);
      expect((await nftV2.walletOfOwner(addr2.address)).length).to.equal(1);
      expect((await nftV2.walletOfOwner(addr3.address)).length).to.equal(5);
      expect(await nftV2.totalSupply()).to.equal(8);
      expect((await nftV2.getPublicSaleConfig()).enabled).to.equal(true);
      expect((await nftV2.getSaleConfig(PRIVATE_SALE_ID)).enabled).to.equal(
        true,
      );
      expect(
        (await nftV2.getSaleConfig(PUBLIC_RAFFLE_SALE_ID)).enabled,
      ).to.equal(false);
    });
  });
});
