const { expect } = require("chai");

const hashWhitelistAccount = (account, saleId) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, saleId])
      .slice(2),
    "hex",
  );
};

describe("Blacklist operator filter", () => {
  let NFT;
  let nft;
  let BlackDustNFT;
  let blackdustNft;
  let blacklistOperatorFilter;

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

    BlacklistOperatorFilter = await ethers.getContractFactory(
      "BlacklistOperatorFilter",
    );

    blacklistOperatorFilter = await BlacklistOperatorFilter.deploy();

    await blacklistOperatorFilter.deployed();

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

    await nft.setOperatorFilter(blacklistOperatorFilter.address);
    await blackdustNft.setOperatorFilter(blacklistOperatorFilter.address);

    await blacklistOperatorFilter.setAddressBlocked(addr4.address, true);

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

  describe("Transfer BlackDust NFT", () => {
    it("safeTransferFrom BlackDust NFT from addr1 -> addr2 CALL FROM addr4 should fail", async () => {
      const totalSupplyCount = await blackdustNft.totalSupply();
      const totalBalance = await blackdustNft.balanceOf(addr1.address);

      expect(totalSupplyCount).to.equal(totalBalance);

      const tokenIds = [0, 2];
      const nft1 = tokenIds[0];
      const nft2 = tokenIds[1];

      const ownerAddress = await blackdustNft.connect(addr1).ownerOf(nft1);
      expect(ownerAddress).to.equal(addr1.address);

      const from = addr1.address;
      const to = addr2.address;

      await blackdustNft.connect(addr1).setApprovalForAll(addr4.address, true);

      try {
        await blackdustNft
          .connect(addr4)
          ["safeTransferFrom(address,address,uint256)"](from, to, nft1);
      } catch (error) {
        expect(error.message).to.contain("illegal operator");
      }

      try {
        await blackdustNft.connect(addr4).transferFrom(from, to, nft2);
      } catch (error) {
        expect(error.message).to.contain("illegal operator");
      }

      await blacklistOperatorFilter.setAddressBlocked(addr4.address, false);

      await blackdustNft.connect(addr4).transferFrom(from, to, nft2);

      const ownerAddressNft2 = await blackdustNft.connect(addr1).ownerOf(nft2);
      expect(ownerAddressNft2).to.be.equal(addr2.address);
    });
  });
});
