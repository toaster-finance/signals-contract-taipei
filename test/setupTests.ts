import { ethers } from "hardhat";
import {
  RangeBetManager,
  RangeBetToken,
  MockCollateralToken,
  RangeBetMath,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export async function setupTestEnvironment() {
  // Contracts
  let rangeBetManager: RangeBetManager;
  let rangeBetToken: RangeBetToken;
  let collateralToken: MockCollateralToken;
  let rangeBetMath: RangeBetMath;

  // Signers
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  // Market parameters
  const tickSpacing = 60;
  const minTick = -360;
  const maxTick = 360;
  let marketId: bigint;
  // 예상 마켓 종료 시간: 현재 시간 + 7일
  const closeTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

  // Initial collateral amounts
  const initialCollateral = ethers.parseEther("1000000");
  const userCollateral = ethers.parseEther("10000");

  // Get signers
  [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();

  // Deploy collateral token
  const MockCollateralToken = await ethers.getContractFactory(
    "MockCollateralToken"
  );
  collateralToken = await MockCollateralToken.deploy(
    "Mock Collateral",
    "MCOL",
    initialCollateral
  );

  // 사용자들이 직접 토큰을 요청
  await collateralToken.connect(user1).requestTokens(userCollateral);
  await collateralToken.connect(user2).requestTokens(userCollateral);
  await collateralToken.connect(user3).requestTokens(userCollateral);
  // User4 gets very small amount for testing insufficient balance scenario
  await collateralToken.connect(user4).requestTokens(ethers.parseEther("1"));
  await collateralToken.connect(user5).requestTokens(userCollateral);

  // Deploy RangeBetMath library
  const RangeBetMathFactory = await ethers.getContractFactory("RangeBetMath");
  rangeBetMath = await RangeBetMathFactory.deploy();
  await rangeBetMath.waitForDeployment();

  // Deploy RangeBetManager with library linking
  const RangeBetManagerFactory = await ethers.getContractFactory(
    "RangeBetManager",
    {
      libraries: {
        RangeBetMath: await rangeBetMath.getAddress(),
      },
    }
  );

  rangeBetManager = await RangeBetManagerFactory.deploy(
    await collateralToken.getAddress(),
    "https://rangebet.example/api/token/"
  );

  // Get RangeBetToken address
  const rangeBetTokenAddress = await rangeBetManager.rangeBetToken();
  rangeBetToken = await ethers.getContractAt(
    "RangeBetToken",
    rangeBetTokenAddress
  );

  // Create a test market
  const tx = await rangeBetManager.createMarket(
    tickSpacing,
    minTick,
    maxTick,
    closeTime
  );
  const receipt = await tx.wait();

  // Get marketId from event
  const marketCreatedEvent = receipt?.logs.find(
    (log) => (log as any).fragment?.name === "MarketCreated"
  );
  marketId = (marketCreatedEvent as any).args[0];

  // Approve collateral for users
  await collateralToken
    .connect(user1)
    .approve(await rangeBetManager.getAddress(), userCollateral);
  await collateralToken
    .connect(user2)
    .approve(await rangeBetManager.getAddress(), userCollateral);
  await collateralToken
    .connect(user3)
    .approve(await rangeBetManager.getAddress(), userCollateral);
  // User4 approves more than their balance
  await collateralToken
    .connect(user4)
    .approve(await rangeBetManager.getAddress(), ethers.parseEther("1000"));
  // User5 approves limited amount
  await collateralToken
    .connect(user5)
    .approve(await rangeBetManager.getAddress(), ethers.parseEther("10"));

  return {
    rangeBetManager,
    rangeBetToken,
    collateralToken,
    rangeBetMath,
    owner,
    user1,
    user2,
    user3,
    user4,
    user5,
    marketId,
    tickSpacing,
    minTick,
    maxTick,
    closeTime,
    initialCollateral,
    userCollateral,
  };
}
