/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from "vscode";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { checkLinuxWebAppDownDetector } from "./checkLinuxWebAppDownDetector";
import { validateWebSite } from "./validateWebSite";

export const postDeployCancelTokens: Map<string, CancellationTokenSource> = new Map();
export async function runPostDeployTask(node: SiteTreeItem, correlationId: string, tokenSource: CancellationTokenSource): Promise<void> {
    // both of these should be happening in parallel so don't await either

    validateWebSite(correlationId, node, tokenSource).then(
        () => {
            // ignore
        },
        () => {
            // ignore
        });

    // this currently only works for Linux apps
    if (node.root.client.isLinux) {
        checkLinuxWebAppDownDetector(correlationId, node, tokenSource).then(
            () => {
                // ignore
            },
            () => {
                // ignore
            });
    }
}
