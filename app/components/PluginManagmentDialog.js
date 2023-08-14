import { db } from "db";
import TextField from "./TextField";
import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

const DEFAULT_PLUGINS_SERVER = "https://sed2.vercel.app/plugins.json";
const ITEMS_PER_PAGE = 10;

function Plugin(props) {
    const plugin = props.plugin;
    return (
        <div index={props.index} className="plugin">
            <div className="plugin-header">
                <div className="logo">
                    <img src={plugin.logo_url} alt={plugin.name_for_human} />
                </div>
                <div className="content">
                    <h3>{plugin.name_for_human}</h3>
                    {plugin.installed ? (
                        <button
                            className="primary gray"
                            onClick={() => uninstallPlugin(plugin.name_for_human)}
                        >
                            Uninstall
                            <span className="material-symbols-outlined">cancel</span>
                        </button>
                    ) : (
                        <button className="primary" onClick={() => installPlugin(plugin)}>
                            Install Plugin
                            <span className="material-symbols-outlined">download</span>
                        </button>
                    )}
                </div>
            </div>
            <p>{plugin.description_for_human}</p>
            <div>
                {plugin.legal_info_url && (
                    <a
                        target="_blank"
                        rel="noreferrer noopener"
                        href={
                            typeof plugin.legal_info_url === "string" &&
                            plugin.legal_info_url.match(/^https?:\/\/\//i) &&
                            plugin.legal_info_url
                        }
                    >
                        <span className="material-symbols-outlined">gavel</span>
                    </a>
                )}
                {plugin.contact_email && (
                    <a href={"mailto:" + plugin.contact_email}>
                        <span className="material-symbols-outlined">mail</span>
                    </a>
                )}
            </div>
        </div>
    );
}

async function uninstallPlugin(name) {
    if (window.confirm(`Are you sure you want to uninstall "${name}"?`)) {
        await db.plugins.where("name_for_human").equals(name).delete();
    }
}

async function installPlugin(plugin) {
    let warning = "Are you sure you want to install this plugin?";
    if (plugin.name_for_human === "TODO Plugin") {
        warning += "\nPlease note, this plugin requires a TODO server to run locally.";
    }

    if (!window.confirm(warning)) {
        return;
    }

    try {
        if (plugin.api.type === "openapi") {
            const response = await fetch(plugin.api.url, { mode: 'no-cors' }); // Modified line
            plugin.openapi_yaml = await response.text();
        }
        await db.plugins.add(plugin);
        return true;
    } catch (error) {
        console.log(error);
        alert("Failed to install plugin, due to: " + error);
        return false;
    }
}

function AddPluginFromURLDialog(props) {
    const [url, setURL] = useState("");
    const [loading, setLoading] = useState(false);

    async function addPlugin() {
        setLoading(true);
        try {
            const response = await fetch(url);
            const plugin = await response.json();
            if (await installPlugin(plugin)) {
                setURL("");
            }
        } catch (error) {
            console.log(error);
            alert("Failed to add plugin, due to: " + error);
        }
        setLoading(false);
    }

    return (
        <div className="dialog">
            <h3>Add Plugin from URL</h3>
            <TextField
                value={url}
                onChange={(e) => setURL(e.target.value)}
                placeholder="Plugin JSON URL"
            />
            <button className="primary" onClick={addPlugin} disabled={loading}>
                Add Plugin
            </button>
        </div>
    );
}

function InstalledPluginsList(props) {
    const plugins = useLiveQuery(() => db.plugins.toArray(), []);
    if (!plugins) return null;

    return (
        <div className="installed-plugins">
            <h3>Installed Plugins</h3>
            {plugins.map((plugin, index) => (
                <Plugin key={index} plugin={plugin} />
            ))}
        </div>
    );
}

export default function PluginManagmentDialog(props) {
    const [plugins, setPlugins] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlugins() {
            try {
                const response = await fetch(DEFAULT_PLUGINS_SERVER);
                const data = await response.json();
                setPlugins(data);
            } catch (error) {
                console.log(error);
            }
            setLoading(false);
        }
        fetchPlugins();
    }, []);

    return (
        <div className="dialog">
            <h3>Plugin Management</h3>
            <InstalledPluginsList />
            <h3>Available Plugins</h3>
            {loading ? (
                <div>Loading...</div>
            ) : (
                plugins
                    .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                    .map((plugin, index) => <Plugin key={index} plugin={plugin} />)
            )}
            <div className="pagination">
                {page > 1 && <button onClick={() => setPage(page - 1)}>Previous</button>}
                {plugins.length > page * ITEMS_PER_PAGE && (
                    <button onClick={() => setPage(page + 1)}>Next</button>
                )}
            </div>
            <AddPluginFromURLDialog />
        </div>
    );
}
