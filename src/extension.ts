'use strict';
import * as vscode from 'vscode';

const configurationSection = 'launch-configuration-templates';

try {
    // TODO properly detect debug mode
    require('source-map-support').install();
} catch(e) {}

export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    console.log('Extension "launch-configuration-templates" activated.');

    const configuration = vscode.workspace.getConfiguration(configurationSection);

    function init() {
        vscode.workspace.onDidChangeConfiguration((e) => {
            if(e.affectsConfiguration(configurationSection)) {
                reregisterDebugProviders();
            }
        });
        reregisterDebugProviders();
    }

    let debugConfigurations: ConfigTemplates;
    function getDebugConfigurations() {
        console.log('getDebugConfigurations()');
        const configTemplates = configuration.inspect<ConfigTemplates>('templates');
        const valuesToMerge = configTemplates ? [configTemplates.globalValue, configTemplates.workspaceValue, configTemplates.workspaceFolderValue] : [{}, {}, {}];
        console.log(valuesToMerge);
        const mergedConfigurationTemplates: ConfigTemplates = Object.assign({}, ...valuesToMerge);
        return mergedConfigurationTemplates;
    }

    /** Map from debug types to the configuration provider */
    const registeredProviders = new Map<string, DisposableReference<vscode.DebugConfigurationProvider>>();

    function reregisterDebugProviders() {
        console.log('reregisterDebugProviders()');
        // refresh cached debug configurations
        debugConfigurations = getDebugConfigurations();

        const allDebugTypes = new Set(Object.entries(debugConfigurations).map(([, value]) => value.debugType));
        console.log(allDebugTypes);
        // add new debug types
        for(const debugType of allDebugTypes) {
            if(!registeredProviders.has(debugType)) {
                const debugProvider = new DebugConfigurationProvider(debugType);
                const disposable = vscode.debug.registerDebugConfigurationProvider(debugType, debugProvider);
                registeredProviders.set(debugType, {disposable, value: debugProvider});
                autoCleanup(disposable);
            }
        }
        // remove debug types that aren't needed anymore
        for(const debugType of registeredProviders.keys()) {
            if(!allDebugTypes.has(debugType)) {
                const pair = registeredProviders.get(debugType)!;
                pair.disposable.dispose();
                registeredProviders.delete(debugType);
            }
        }
    }

    function autoCleanup(disposable: vscode.Disposable) {
        context.subscriptions.push(disposable);
    }

    class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
        constructor(private debugType: string) {}
        provideDebugConfigurations(workspaceFolder: vscode.WorkspaceFolder | undefined) {
            const configurations = Object.entries(debugConfigurations).map(([, value]) => value).filter(value => value.debugType === this.debugType).map(v => v.debugConfiguration);
            console.log(configurations.length);
            console.log(configurations);
            return configurations;
        }
    }

    init();
}

// this method is called when your extension is deactivated
export function deactivate() {
}

interface DisposableReference<T> {
    value: T;
    disposable: vscode.Disposable;
}

interface ConfigTemplates {
    [name: string]: ConfigTemplate;
}

interface ConfigTemplate {
    debugType: string;
    displayName: string;
    debugConfiguration: vscode.DebugConfiguration;
}
