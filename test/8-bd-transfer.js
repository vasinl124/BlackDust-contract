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

  describe("Transfer BlackDust NFT", () => {
    it("safeTransferFrom BlackDust NFT from addr1 -> addr2 addr1 should not have it anymore addr2 should have it", async () => {
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

      await blackdustNft
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](from, to, nft1);

      const ownerAddressNft1 = await blackdustNft.connect(addr1).ownerOf(nft1);
      expect(ownerAddressNft1).to.be.equal(addr2.address);

      await blackdustNft.connect(addr1).transferFrom(from, to, nft2);

      const ownerAddressNft2 = await blackdustNft.connect(addr1).ownerOf(nft2);
      expect(ownerAddressNft2).to.be.equal(addr2.address);

      const tokensOwnedByAddr2 = await blackdustNft.balanceOf(addr2.address);

      const ownedTokenIds = await blackdustNft.walletOfOwner(addr2.address);

      ownedTokenIds.map((tokenId, index) => {
        expect(tokenId).to.be.equal(tokenIds[index]);
      });

      expect(tokensOwnedByAddr2).to.be.equal(2);
    });

    it("Transfer NFT from addr1 -> addr2 tokenId 1 walletOfOwner addr2 should have only tokenId 1", async () => {
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

      await blackdustNft.connect(addr1).transferFrom(from, to, nft2);

      const ownerAddressNft2 = await blackdustNft.connect(addr1).ownerOf(nft2);
      expect(ownerAddressNft2).to.be.equal(addr2.address);

      const tokensOwnedByAddr2 = await blackdustNft.balanceOf(addr2.address);

      const ownedTokenIds = await blackdustNft.walletOfOwner(addr2.address);

      ownedTokenIds.map((tokenId) => {
        expect(tokenId).to.be.equal(nft2);
      });

      expect(tokensOwnedByAddr2).to.be.equal(1);
    });

    it("Should Fail: non owner try to transfer to zero address or dead wallet", async () => {
      expect(await blackdustNft.totalSupply()).to.be.equal(2);

      const from = addr1.address;
      const deadWalletAddress = "0x000000000000000000000000000000000000dEaD";

      await nft.connect(addr1).awaken(1); // tokenId 1

      expect(await blackdustNft.totalSupply()).to.be.equal(3);

      const tokenIds = [0, 1, 2];
      const nft1 = tokenIds[0];
      const nft2 = tokenIds[1];

      try {
        await blackdustNft.connect(addr2).burn(nft2);
      } catch (error) {
        expect(error.message).to.contain(
          "caller is not token owner nor approved",
        );
      }

      try {
        await blackdustNft
          .connect(addr2)
          ["safeTransferFrom(address,address,uint256)"](
            from,
            deadWalletAddress,
            nft1,
          );
      } catch (error) {
        expect(error.message).to.contain(
          "caller is not token owner nor approved",
        );
      }

      const addr1TokenIds = await blackdustNft
        .connect(addr2)
        .walletOfOwner(addr1.address);
      expect(await addr1TokenIds.length).to.be.equal(3);

      expect(await blackdustNft.totalSupply()).to.be.equal(3);
    });

    it("Should PASS: transfer to zero address or dead wallet should reduce totalSupply", async () => {
      expect(await blackdustNft.totalSupply()).to.be.equal(2);

      const from = addr1.address;
      const deadWalletAddress = "0x000000000000000000000000000000000000dEaD";

      await nft.connect(addr1).awaken(1); // tokenId 1

      expect(await blackdustNft.totalSupply()).to.be.equal(3);

      const tokenIds = [0, 1, 2];
      const nft1 = tokenIds[0];
      const nft2 = tokenIds[1];

      await blackdustNft.connect(addr1).burn(nft2);
      expect(await blackdustNft.totalSupply()).to.be.equal(2);

      await blackdustNft
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](
          from,
          deadWalletAddress,
          nft1,
        );
      expect(await blackdustNft.totalSupply()).to.be.equal(1);
    });
  });
});
