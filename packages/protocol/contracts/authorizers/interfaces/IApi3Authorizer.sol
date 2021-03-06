// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "./IAuthorizer.sol";

interface IApi3Authorizer is IAuthorizer {
    // Unauthorized (0):  Cannot do anything
    // Admin (1):         Can extend whitelistings
    // Super admin (2):   Can set (i.e., extend or revoke) whitelistings, blacklist
    enum AdminStatus {
        Unauthorized,
        Admin,
        SuperAdmin
        }

    event SetMetaAdmin(address metaAdmin);

    event SetAdminStatus(
        address indexed admin,
        AdminStatus status
        );

    event RenouncedAdminStatus(address indexed admin);

    event ExtendedWhitelistExpiration(
        bytes32 indexed airnodeId,
        address indexed clientAddress,
        uint256 expiration,
        address indexed admin
        );

    event SetWhitelistExpiration(
        bytes32 indexed airnodeId,
        address indexed clientAddress,
        uint256 expiration,
        address indexed admin
        );

    event SetBlacklistStatus(
        address indexed clientAddress,
        bool status,
        address indexed admin
        );

    function setMetaAdmin(address _metaAdmin)
        external;

    function setAdminStatus(
        address admin,
        AdminStatus status
        )
        external;

    function renounceAdminStatus()
        external;

    function extendWhitelistExpiration(
        bytes32 airnodeId,
        address clientAddress,
        uint256 expiration
        )
        external;

    function setWhitelistExpiration(
        bytes32 airnodeId,
        address clientAddress,
        uint256 expiration
        )
        external;
  
    function setBlacklistStatus(
        address clientAddress,
        bool status
        )
        external;
}
