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

describe("NFT Contract Transfer", () => {
  let NFT;
  let nft;

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

  describe("Transfer NFT", () => {
    it("Transfer NFT from addr1 -> addr2 addr1 should not have it anymore addr2 should have it", async () => {
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

      expect(totalSupplyCount).to.equal(totalBalance);

      const nftMinted = receipt.events?.filter((x) => {
        return x.event == "NFTMinted";
      });
      expect(nftMinted).to.length(1);

      const tokenIds = [];
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
        tokenIds.push(i);
      }

      const nft1 = tokenIds[0];
      const nft2 = tokenIds[1];

      const ownerAddress = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddress).to.equal(addr1.address);

      const from = addr1.address;
      const to = addr2.address;

      await nft
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](from, to, nft1);

      const ownerAddressNft1 = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddressNft1).to.be.equal(addr2.address);

      await nft.connect(addr1).transferFrom(from, to, nft2);

      const ownerAddressNft2 = await nft.connect(addr1).ownerOf(nft2);
      expect(ownerAddressNft2).to.be.equal(addr2.address);

      const tokensOwnedByAddr2 = await nft.balanceOf(addr2.address);

      const ownedTokenIds = await nft.walletOfOwner(addr2.address);

      ownedTokenIds.map((tokenId, index) => {
        expect(tokenId).to.be.equal(tokenIds[index]);
      });

      expect(tokensOwnedByAddr2).to.be.equal(2);
    });

    it("Transfer NFT from addr1 -> addr2 tokenId 1 walletOfOwner addr2 shoudl have only tokenId 1", async () => {
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

      expect(totalSupplyCount).to.equal(totalBalance);

      const nftMinted = receipt.events?.filter((x) => {
        return x.event == "NFTMinted";
      });
      expect(nftMinted).to.length(1);

      const tokenIds = [];
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
        tokenIds.push(i);
      }

      const nft1 = tokenIds[0];
      const nft2 = tokenIds[1];

      const ownerAddress = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddress).to.equal(addr1.address);

      const from = addr1.address;
      const to = addr2.address;

      await nft.connect(addr1).transferFrom(from, to, nft2);

      const ownerAddressNft2 = await nft.connect(addr1).ownerOf(nft2);
      expect(ownerAddressNft2).to.be.equal(addr2.address);

      const tokensOwnedByAddr2 = await nft.balanceOf(addr2.address);

      const ownedTokenIds = await nft.walletOfOwner(addr2.address);

      ownedTokenIds.map((tokenId) => {
        expect(tokenId).to.be.equal(nft2);
      });

      expect(tokensOwnedByAddr2).to.be.equal(1);
    });
  });
});
