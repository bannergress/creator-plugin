# creator-plugin

## Overview

This plugin syncs missions from the mission creator website to Bannergress. It does that the following way:
1. Download the list of missions from the user.
2. Upload the list of missions to Bannergress. This syncs statistics (number completed, average rating) and status with Bannergress.
3. Retrieve the subset of these missions for which Bannergress does not have any details.
4. Fetch the details of all these missions.
5. Upload these details to Bannergress.

## Build

The source file creator-plugin-bannergress.user.js can directly be used as plugin in Tampermonkey or IITC button, no compilation required.

## Known limitations

* The plugin does not sync mission status for missions which have been permanently deleted, since they are not in the user list anymore.
* The plugin does not sync mission details when mission details are available in Bannergress.
