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
describe("NFT Role Guards", () => {
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

  describe("OnlyDevMultiSig", () => {
    it("Get current devMultiSigWallet", async () => {
      const devMultiSigWallet = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWallet).to.equal(devMultisig);
    });

    it("Set new devMultiSigWallet should fail -> non dev multisig try to update dev multisig wallet", async () => {
      const devMultiSigWallet = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWallet).to.equal(devMultisig);

      try {
        await nft.connect(addr1).updateDevMultiSigWallet(addr4.address);
      } catch (error) {
        expect(error.message).to.contain("ONLY_DEV_MULTISIG");
      }
    });

    it("Set new devMultiSigWallet should PASS ", async () => {
      const devMultiSigWallet = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWallet).to.equal(devMultisig);

      await nft.connect(addr3).updateDevMultiSigWallet(addr4.address);

      const devMultiSigWalletNew = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWalletNew).to.equal(addr4.address);
    });
  });

  describe("OnlyExpeller", () => {
    it("Get current expellerAddress", async () => {
      const expellerAddress = await blackdustNft
        .connect(addr1)
        .expellerAddress();
      expect(expellerAddress).to.equal(owner.address);
    });

    it("Set new expellerAddress should fail -> non dev multisig try to update dev multisig wallet", async () => {
      const expellerAddress = await blackdustNft
        .connect(addr1)
        .expellerAddress();
      expect(expellerAddress).to.equal(owner.address);

      try {
        await blackdustNft.connect(addr1).updateExpellerAddress(addr4.address);
      } catch (error) {
        expect(error.message).to.contain("caller is not the owner");
      }
    });

    it("Set new expellerAddress should PASS ", async () => {
      const expellerAddress = await blackdustNft
        .connect(addr1)
        .expellerAddress();
      expect(expellerAddress).to.equal(owner.address);

      await blackdustNft.connect(owner).updateExpellerAddress(addr4.address);

      const expellerAddressNew = await blackdustNft
        .connect(addr1)
        .expellerAddress();
      expect(expellerAddressNew).to.equal(addr4.address);
    });
  });
});
