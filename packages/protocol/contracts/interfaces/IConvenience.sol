// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./IAirnodeRrp.sol";

interface IConvenience {
    function setAirnodeParametersAndForwardFunds(
        address admin,
        string calldata xpub,
        address[] calldata authorizers
        )
        external
        payable
        returns (bytes32 airnodeId);

    function getAirnodeParametersAndBlockNumber(bytes32 airnodeId)
        external
        view
        returns (
            address admin,
            string memory xpub,
            address[] memory authorizers,
            uint256 blockNumber
        );

    function getTemplates(bytes32[] calldata templateIds)
        external
        view
        returns (
            bytes32[] memory airnodeIds,
            bytes32[] memory endpointIds,
            bytes[] memory parameters
        );

    function checkAuthorizationStatuses(
        bytes32 airnodeId,
        bytes32[] calldata requestIds, 
        bytes32[] calldata endpointIds,
        uint256[] calldata requesterIndices,
        address[] calldata designatedWallets,
        address[] calldata clientAddresses
        )
        external
        view
        returns (bool[] memory statuses);
}
