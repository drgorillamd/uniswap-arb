const { BigNumber } = require("@ethersproject/bignumber");
const { ethers, waffle } = require("hardhat");
require('dotenv').config;

const DAI =  '0x6b175474e89094c44da98b954eedeac495271d0f';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // dai<weth -> dai is token0

const addresses = {
    'UniswapV2': '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
    'Sushiswap': '0xc3d03e4f041fd4cd388c549ee2a29a9e5075882f',
    'Shebaswap' : '0x8faf958e36c6970497386118030e6297fff8d275',
    'Sakeswap': '0x2ad95483ac838e2884563ad278e933fba96bc242',
    'Croswap': '0x60a26d69263ef43e9a68964ba141263f19d71d51'};

const abiPool = ["function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];
const provider = waffle.provider;

const GWEI = ethers.BigNumber.from(10).pow(18);

async function main() {
    // -- init --
    let contracts = {};
    for (const [dex, adr] of Object.entries(addresses)) {
        contracts[dex]=new ethers.Contract(adr, abiPool, provider);
    }

    const Contract = await ethers.getContractFactory("ExecArb", provider);
    const ExecArb = await Contract.deploy();

    const [deployer] = await ethers.getSigners();

    // -- in live, provider.on('mined') starts here, looking for arb after each new block
    try {
        // --get prices and sort them --
        let prices = {};
        let reserves = {};
        for (const [dex, contract] of Object.entries(contracts)) {
            const [reserveDai, reserveWeth] = await contract.getReserves();           
            const curr_price = reserveDai.div(reserveWeth);
            prices[dex] = curr_price.toNumber();
            reserves[dex] = [reserveDai, reserveWeth];
        }

        const pricesArr = Object.values(prices);
        const dexIn = Object.keys(prices).find(key => prices[key] === Math.max(...pricesArr)); //eth cost more here -> we start from eth
        const dexOut = Object.keys(prices).find(key => prices[key] === Math.min(...pricesArr)); //eth is trading at discount here/min price

        const [reserve_Dai_firstPool, reserve_Weth_firstPool] = reserves[dexIn];
        const [reserve_Dai_secondPool, reserve_Weth_secondPool] = reserves[dexOut];

        console.log("In : "+dexIn+"@"+prices[dexIn]+" reserves :"+reserve_Dai_firstPool+" dai - eth "+reserve_Weth_firstPool);
        console.log("Out : "+dexOut+"@"+prices[dexOut]+" reserves :"+reserve_Dai_secondPool+" dai - eth "+reserve_Weth_secondPool);

        //computing first leg, eth to dai:
        //how much dai to take the biggest spread ?
        //params : truePriceDai, truePriceEth, reserveDai, reserveEth
        const [AToB, amountInDai] = await ExecArb.computeProfitMaximizingTrade(prices[dexOut], 1, reserve_Dai_firstPool, reserve_Weth_firstPool);
        console.log("Amount of DAI received : "+amountInDai.div(GWEI).toString()+" A to B"+AToB);
        
        const numerator = reserve_Weth_firstPool.mul(amountInDai).mul(1000);
        const denominator = reserve_Dai_firstPool.sub(amountInDai).mul(997);
        const amountInEth = numerator.div(denominator).add(1);

        console.log("corresponding to "+amountInEth.toString()+" eth swapped in first pool");

        //computing second leg, dai to eth:
        const amountInWithFee = amountInDai.mul(997);
        const num = amountInWithFee.mul(reserve_Weth_secondPool);
        const denom = reserve_Dai_secondPool.mul(1000).add(amountInWithFee);
        const amountOutEth = num.div(denom);

        console.log("for "+amountOutEth.toString()+" eth received from second pool");
  
        const overrides = {value: amountInEth};
        const DaiToEth = await ExecArb.callStatic.execArb(contracts[dexIn].address, contracts[dexOut].address, amountInDai, amountOutEth, overrides);
        console.log("simulated eth from closing second leg: "+DaiToEth.toString());

    } catch (e) {
        console.log(e);
    }
}

/* sort by asc order
 arb the extrema, pop(extrema), arb extrema  --  if 2 price identical, take the biggest liq
 max slippage = target price !
 transfer in to pair
 pair.swap */



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
