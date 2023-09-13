const PUBLIC_RAFFLE_SALE_ID = 1;
const PRIVATE_SALE_ID = 2;
const ALLY_SALE_ID = 3;

const privateSaleMaxPerWallet = 1;
const privateSaleMaxPerTransaction = 1;

const publicRaffleSaleMaxPerWallet = 2;
const publicRaffleSaleMaxPerTransaction = 2;

const publicSaleMaxPerTransaction = 5;

const testnetPrivateSaleUnitPrice = 0.01;
const mainnetPrivateSaleUnitPrice = 0.15;

const testnetPublicRaffleSaleUnitPrice = 0.02;
const mainnetPublicRaffleSaleUnitPrice = 0.25;

const testnetPublicSaleUnitPrice = 0.02;
const mainnetPublicSaleUnitPrice = 0.25;

const contratsToDeploy = {
  takrut: {
    deploy: false,
    verify: false,
    upgrade: false,
    verifyUpgrade: false,
  },
  blackdust: {
    deploy: true,
    verify: true,
  },
  blacklistOperatorFilter: {
    deploy: false,
    verify: false,
  },
};

const networkConfig = {
  default: {
    name: "hardhat",
    fee: "100000000000000000",
    keyHash:
      "0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4",
    jobId: "29fa9aa13bf1468788b7cc4a500a45b8",
    fundAmount: "1000000000000000000",
  },
  1: {
    name: "main",
    wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    devMultisigAddress: "0x8189Ae50db5e5BA8A0663C976cc9E058Ee531f1E",
    takrut: {
      contractName: "Takrut",
      contractSymbol: "TAKRUT",
      initBaseURI: "https://api.blackdustnft.com/api/v1/takrut/tokens/",
      royalty: 750,
      allySaleConfig: {
        saleId: ALLY_SALE_ID,
        maxPerWallet: privateSaleMaxPerWallet,
        maxPerTransaction: privateSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          mainnetPrivateSaleUnitPrice.toString(),
        ),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 5000,
      },
      privateSaleConfig: {
        saleId: PRIVATE_SALE_ID,
        maxPerWallet: privateSaleMaxPerWallet,
        maxPerTransaction: privateSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          mainnetPrivateSaleUnitPrice.toString(),
        ),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 5000,
      },
      publicRaffleSaleConfig: {
        saleId: PUBLIC_RAFFLE_SALE_ID,
        maxPerWallet: publicRaffleSaleMaxPerWallet,
        maxPerTransaction: publicRaffleSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          mainnetPublicRaffleSaleUnitPrice.toString(),
        ),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 5000,
      },
      publicSaleConfig: {
        maxPerTransaction: publicSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          mainnetPublicSaleUnitPrice.toString(),
        ),
      },
      freeMintSignerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
    },
    blackdust: {
      contractName: "Black Dust",
      contractSymbol: "BLACKDUST",
      initBaseURI: "https://api.blackdustnft.com/api/v1/blackdust/tokens/",
      royalty: 750,
    },
  },
  5: {
    name: "goerli",
    wethAddress: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
    devMultisigAddress: "0xC54855c09F2E8b3430F81fc7b664ca6CE9ceC67D",
    takrut: {
      contractName: "SALTKRUT",
      contractSymbol: "SALT",
      initBaseURI: "https://staging-alphiewhales.herokuapp.com/tokens/",
      royalty: 750,
      allySaleConfig: {
        saleId: ALLY_SALE_ID,
        maxPerWallet: privateSaleMaxPerWallet,
        maxPerTransaction: privateSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          testnetPrivateSaleUnitPrice.toString(),
        ),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 5000,
      },
      privateSaleConfig: {
        saleId: PRIVATE_SALE_ID,
        maxPerWallet: privateSaleMaxPerWallet,
        maxPerTransaction: privateSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          testnetPrivateSaleUnitPrice.toString(),
        ),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 5000,
      },
      publicRaffleSaleConfig: {
        saleId: PUBLIC_RAFFLE_SALE_ID,
        maxPerWallet: publicRaffleSaleMaxPerWallet,
        maxPerTransaction: publicRaffleSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          testnetPublicRaffleSaleUnitPrice.toString(),
        ),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 5000,
      },
      publicSaleConfig: {
        maxPerTransaction: publicSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          testnetPublicSaleUnitPrice.toString(),
        ),
      },
      freeMintSignerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
    },
    blackdust: {
      contractName: "Thai Pepper",
      contractSymbol: "THPEP",
      initBaseURI: "https://staging-alphiewhales.herokuapp.com/tokens/",
      royalty: 750,
    },
  },
};

const CONTRACTS = {
  nft: "Takrut",
  nftUpgrade: "TakrutV2",
  blackdust: "BlackDust",
  blackdustUpgrade: "BlackDustV2",
  blacklistOperatorFilter: "BlacklistOperatorFilter",
};

module.exports = {
  contratsToDeploy,
  networkConfig,
  CONTRACTS,
};
