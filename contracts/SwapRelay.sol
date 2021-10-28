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

contract SwapRelay {

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
        msg.sender.call{value: address(this).balance}("");
        return address(this).balance;
    }

}
