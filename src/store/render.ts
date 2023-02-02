import { CoreKinematics, KinematicsName, NetworkInterfaceType } from "@duet3d/objectmodel";
import ejs from "ejs";

import { useStore } from "@/store";

import packageInfo from "../../package.json";
import { ConfigPort, ConfigPortFunction, stripBoard } from "./model/ConfigPort";
import { isDefaultCoreKinematics } from "./defaults";
import { ExpansionBoards, getExpansionBoardDefinition } from "./ExpansionBoards";
import { ConfigDriverMode } from "./model/ConfigDriver";

const store = useStore();

/**
 * Indent the comments in a G-code file
 * @param content File content
 * @returns Indented file content
 */
export function indent(content: string): string {
    const lines = content.split('\n');

    // Find out how long the maximum command is
    let maxCommandLength = 0;
    for (const line of lines) {
        const commentIndex = line.startsWith(';') ? line.substring(1).indexOf(';') - 1 : line.indexOf(';');
        if (commentIndex > maxCommandLength) {
            maxCommandLength = commentIndex;
        }
    }

    // Align line comments
    let newResult = "";
    for (const line of lines) {
        const commentIndex = line.indexOf(';');
        if (commentIndex <= 0) {
            newResult += line + '\n';
        } else {
            const command = line.substring(0, commentIndex - 1), comment = line.substring(commentIndex);

            let indentation = "";
            for (let i = command.length; i < maxCommandLength; i++) {
                indentation += ' ';
            }

            newResult += command + indentation + comment + '\n';
        }
    }
    return newResult.trim();
}

const renderOptions = {
    // Basics
    model: store.data,
    render,
    /* renderArgs, */
    version: packageInfo.version,

    // Display helpers
    capitalize(value: string) {
        return (value.length > 0) ? value.charAt(0).toUpperCase() + value.slice(1) : value;
    },
    escape(value: string) {
        return '"' + value.replace(/"/g, '""').replace(/'/g, "''") + '"';
    },
    params(params: Record<string, any>) {
        return Object.keys(params)
                .filter(key => (params[key] !== undefined) && (!(params[key] instanceof Array) || params[key].length > 0))
                .map(key => {
                    const value = params[key]
                    if (value === null) {
                        return key;
                    }
                    if (typeof value === "string") {
                        return key + this.escape(value);
                    }
                    if (value instanceof Array) {
                        return key + value.join(':');
                    }
                    return key + value;
                }, this)
                .join(' ');
    },
    precise(value: number, digitsToShow: number = 0) {
        const factor = 10 ** digitsToShow;
        return (Math.round(value * factor) / factor);
    },

    // Ports
    getPort(fn: ConfigPortFunction, index?: number, secondaryIndex?: number): ConfigPort | null {
        let secondaryCounter = 0;
        for (const port of store.data.configTool.ports) {
            if (port.function === fn && ((index === undefined) || (index === port.index)) && ((secondaryIndex === undefined) || (secondaryIndex === secondaryCounter++))) {
                return port;
            }
        }
        return null;
    },
    getPortString(fn: ConfigPortFunction, index?: number, secondaryIndex?: number): string | null {
        const port = this.getPort(fn, index, secondaryIndex);
        return (port != null) ? port.toString() : null;
    },
    getCombinedPort(fns: Array<ConfigPortFunction>, index?: number): string {
        const ports: Array<string> = [];
        for (const fn of fns) {
            let portFound = false;
            for (const port of store.data.configTool.ports) {
                if (port.function === fn && ((index === undefined) || (index === port.index))) {
                    if (ports.length === 0) {
                        ports.push(port.toString());
                    } else {
                        ports.push(stripBoard(port.toString()));
                    }
                    portFound = true;
                    break;
                }
            }
            if (!portFound) {
                ports.push("nil");
            }
        }
        for (let i = ports.length - 1; i > 0; i--) {
            if (ports[i] === "nil") {
                ports.unshift();
            } else {
                break;
            }
        }
        return ports.join('+');
    },

    // Boards
    mainboard: null,
    ExpansionBoards,
    getExpansionBoardDefinition,

    // Kinematics
    ConfigDriverMode,
    ConfigPortFunction,
    CoreKinematics,
    isDefaultCoreKinematics,
    KinematicsName,

    // Other
    NetworkInterfaceType
};
Object.defineProperty(renderOptions, "mainboard", { get: () => store.data.boards.find(board => !board.canAddress) });

// DEBUG:
(window as any).renderOptions = renderOptions;

/**
 * Render a file and obtain the result as a string
 * @param filename Name of the file to render
 * @param args Custom arguments to pass in the EJS context
 * @returns Rendered file
 */
export async function render(filename: string, args: Record<string, any> = {}): Promise<string> {
    const fullFilename = `${import.meta.env.BASE_URL}templates/${filename}`;
    const response = await fetch(fullFilename);
    if (response.ok) {
        const responseText = await response.text();
        const renderArgs: Record<string, any> = { ...args, ...renderOptions };
        if (!("preview" in renderArgs)) {
            renderArgs.preview = false;
        }
        try {
            return await ejs.render(responseText, { ...renderArgs, renderArgs }, { async: true, cache: false });
        } catch (e) {
            console.warn(`Failed to render file ${fullFilename}`);
            throw e;
        }
    }
    throw new Error(`Failed to get ${fullFilename}: ${response.status} ${response.statusText}`);
}

/**
 * Write custom code to a new tab window
 * @param title Title of the new tab
 * @param content Code content of the new tab
 */
export function writeToTab(title: string, content: string) {
    const tab = window.open("about:blank", "_blank");
    if (tab === null) {
        alert("Could not open a new tab!\n\nPlease allow pop-ups for this page and try again.");
    } else {
        tab.document.write(content.replace(/\n/g, "<br>").replace(/ /g, "&nbsp;"));
        tab.document.body.style.fontFamily = "'Courier New', Courier, monospace";
        tab.document.title = title;
        tab.document.close();
    }
}