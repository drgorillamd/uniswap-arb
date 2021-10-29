//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface IERC20AtMinima {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface WETHBusiness {
    function withdraw(uint wad) external;
}

interface poolMinima {
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
}

contract ExecArb {

    //hardcoded for gas optim
    address DAI =  address(0x6B175474E89094C44Da98b954EedeAC495271d0F); //token0
    address WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    constructor() {
    }

    function execArb(address firstPool, address secondPool, uint256 amountDaiOut, uint256 amountEthOut) external payable returns(uint256){

        // -- deposit/mint WETH --
        WETH.call{value: msg.value}("");

        // -- buy dai --
        uint256 balWETH = IERC20AtMinima(WETH).balanceOf(address(this));
        IERC20AtMinima(WETH).transfer(firstPool, balWETH);
        poolMinima(firstPool).swap(amountDaiOut, 0, address(this), "");

        // -- sell dai --
        uint256 newBalDai = IERC20AtMinima(DAI).balanceOf(address(this));
        IERC20AtMinima(DAI).transfer(secondPool, newBalDai);
        poolMinima(secondPool).swap(0, amountEthOut, address(this), "");

        // -- take back profit --
        balWETH = IERC20AtMinima(WETH).balanceOf(address(this));
        WETHBusiness(WETH).withdraw(balWETH);

        // -- used to be selfdestruct :/ --
        balWETH = address(this).balance;
        msg.sender.call{value: balWETH}("");
        return balWETH;
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
        // else z = 0
    }

    function fullMul(uint256 x, uint256 y) internal pure returns (uint256 l, uint256 h) {
        uint256 mm = mulmod(x, y, type(uint256).max);
        l = x * y;
        h = mm - l;
        if (mm < l) h -= 1;
    }

    function fullDiv(
        uint256 l,
        uint256 h,
        uint256 d
    ) private pure returns (uint256) {
        uint256 pow2 = d & (~d+1);
        d /= pow2;
        l /= pow2;
        l += h * ((~pow2+1) / pow2 + 1);
        uint256 r = 1;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        return l * r;
    }

    function mulDiv(
        uint256 x,
        uint256 y,
        uint256 d
    ) internal pure returns (uint256) {
        (uint256 l, uint256 h) = fullMul(x, y);

        uint256 mm = mulmod(x, y, d);
        if (mm > l) h -= 1;
        l -= mm;

        if (h == 0) return l / d;

        require(h < d, 'FullMath: FULLDIV_OVERFLOW');
        return fullDiv(l, h, d);
    }

    // computes the direction and magnitude of the profit-maximizing trade
    function computeProfitMaximizingTrade(
        uint256 truePriceTokenA,
        uint256 truePriceTokenB,
        uint256 reserveA,
        uint256 reserveB
    ) pure external returns (bool aToB, uint256 amountIn) {
        aToB = mulDiv(reserveA, truePriceTokenB, reserveB) < truePriceTokenA;

        uint256 invariant = reserveA* reserveB;

        uint256 leftSide = sqrt(
            mulDiv(
                invariant * 1000,
                aToB ? truePriceTokenA : truePriceTokenB,
                (aToB ? truePriceTokenB : truePriceTokenA) * 997
            )
        );
        uint256 rightSide = (aToB ? reserveA*1000 : reserveB*1000) / 997;

        if (leftSide < rightSide) return (false, 0);

        // compute the amount that must be sent to move the price to the profit-maximizing price
        amountIn = leftSide-rightSide;
    }


}