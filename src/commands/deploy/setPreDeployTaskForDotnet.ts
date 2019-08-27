/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as constants from '../../constants';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "./IDeployWizardContext";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext, siteConfig: SiteConfig): Promise<void> {
    const preDeployTaskSetting: string = 'preDeployTask';
    const configurePreDeployTasksSetting: string = 'configurePreDeployTasks';

    // don't overwrite preDeploy task if it exists and respect configurePreDeployTasks setting
    if (!getWorkspaceSetting<boolean>(configurePreDeployTasksSetting, context.workspace.uri.fsPath) || getWorkspaceSetting<string>(preDeployTaskSetting, context.workspace.uri.fsPath)) {
        return;
    }

    // assume that the csProj is in the root at first
    let csprojFsPath: string = context.workspace.uri.fsPath;

    const csprojFile: string | undefined = await tryGetCsprojFile(csprojFsPath);

    if (csprojFile) {
        csprojFsPath = path.dirname(csprojFile);
    }

    // if we found a .csproj file or we know the runtime is .NET, set the tasks and workspace settings
    // assumes the .csproj file is in the root if one was not found
    if (csprojFile || (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.toLowerCase().includes('dotnet'))) {
        // follow the publish output patterns, but leave out targetFramework
        // use the absolute path so the bits are created in the root, not the subpath
        const publishPath: string = path.join('bin', 'Debug', 'publish');
        const dotnetOutputPath: string = path.join(context.workspace.uri.fsPath, publishPath);

        await updateWorkspaceSetting(preDeployTaskSetting, 'publish', context.workspace.uri.fsPath);
        await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, publishPath, context.workspace.uri.fsPath);

        // update the deployContext with the .NET output path since getDeployFsPath is called prior to this
        context.deployFsPath = dotnetOutputPath;

        const publishCommand: string = `dotnet publish ${csprojFsPath} -o ${dotnetOutputPath}`;
        const publishTask: tasks.ITask[] = [{
            label: 'clean',
            command: `dotnet clean ${csprojFsPath}`,
            type: 'shell'
        },
        {
            label: 'publish',
            command: publishCommand,
            type: 'shell',
            dependsOn: 'clean'
        }];

        tasks.updateTasks(context.workspace, publishTask);

    }

    async function tryGetCsprojFile(projectPath: string): Promise<string | undefined> {
        let projectFiles: string[] = await checkFolderForCsproj(projectPath);
        // it's a common pattern to have the .csproj file in a subfolder so check one level deep
        if (projectFiles.length === 0) {
            for (const folder of fse.readdirSync(projectPath)) {
                const filePath: string = path.join(projectPath, folder);
                if (fse.existsSync(filePath) && (await fse.stat(filePath)).isDirectory()) {
                    projectFiles = projectFiles.concat(await checkFolderForCsproj(filePath));
                }
            }
        }

        context.telemetry.properties.numOfCsprojFiles = projectFiles.length.toString();

        return projectFiles.length === 1 ? projectFiles[0] : undefined;

        async function checkFolderForCsproj(filePath: string): Promise<string[]> {
            const files: string[] = fse.readdirSync(filePath);
            const filePaths: string[] = files.map((f: string) => {
                return path.join(filePath, f);
            });

            return filePaths.filter((f: string) => /\.csproj$/i.test(f));
        }
    }

}