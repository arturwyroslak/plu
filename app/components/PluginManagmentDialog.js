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
                            plugin.legal_info_url.match(/^https?:\/\//i) &&
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
            // Używamy serwera proxy zamiast bezpośredniego odwołania do zewnętrznego API
            const proxyUrl = `/api/proxy?target=${encodeURIComponent(plugin.api.url)}`;
            const response = await fetch(proxyUrl);
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
    const [error, setError] = useState("");
    const [plugin, setPlugin] = useState(null);
    const [authData, setAuthData] = useState({});

    async function downloadPlugin(event) {
        setError("");
        setPlugin(null);

        let url;
        try {
            url = new URL(event.target.value);
        } catch {
            return;
        }

        if (!url.pathname.endsWith(".json")) {
            url.pathname = "/.well-known/ai-plugin.json";
        }

        // Ensure the URL is HTTP or HTTPS
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return;
        }

        let response;
        try {
            response = await fetch(url.toString(), { cache: "no-cache" });
        } catch {
            // If the fetch fails, try again with 'no-cors' mode
            try {
                response = await fetch(url.toString(), { mode: 'no-cors', cache: "no-cache" });
            } catch {
                return;
            }
        }

        if (response.status !== 200) {
            return setError("Failed to download plugin manifest");
        }

        let plugin;
        try {
            plugin = await response.json();
        } catch {
            return setError("Invalid plugin manifest");
        }

        plugin.installed = await db.plugins.where("name_for_human").equals(plugin.name_for_human).count() > 0;
        setPlugin(plugin);
    }

    async function handleInstallation(event) {
        event.preventDefault();

        const exists = await db.plugins.where("name_for_human").equals(plugin.name_for_human).count() > 0;

        if (exists) {
            return uninstallPlugin(plugin.name);
        }

        // If the plugin requires authentication, add the auth data to the plugin object
        if (plugin.is_user_authenticated) {
            plugin.auth_data = authData;
        }

        if (await installPlugin(plugin)) {
            props.updatePage(0);
        }
    }

    return (
        <>
            <header>
                <span onClick={props.onClose} className="material-symbols-outlined">
                    close
                </span>
                <h1>
                    <button style={{ marginRight: 10 }} onClick={() => props.updatePage(0)}>
                        Back
                    </button>
                    Add plugin
                </h1>
            </header>
            <div className="dialog-content">
                <form onSubmit={handleInstallation}>
                    <TextField
                        label="Search"
                        hint={error}
                        onChange={downloadPlugin}
                        placeholder="https://example.com"
                        type="url"
                        pattern="^https?://.*"
                        title="Must be a valid website URL"
                    />
                    {plugin && plugin.requires_auth && (
                        <>
                            <TextField
                                label="Username"
                                onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                            />
                            <TextField
                                label="Password"
                                type="password"
                                onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                            />
                        </>
                    )}
                    {plugin && (
                        <div style={{ display: "flex" }}>
                            <Plugin plugin={plugin} />
                        </div>
                    )}
                </form>
            </div>
        </>
    );
}

function InstalledPluginsList(props) {
    const [plugins, setPlugins] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const installedPlugins = useLiveQuery(() => db.plugins.toArray());

    useEffect(() => {
        const plugins_server_url = props?.settings?.plugins_server_url || DEFAULT_PLUGINS_SERVER;
        fetch(plugins_server_url + "?r=" + Math.random(), { cache: "no-cache" })
            .then((response) => response.json())
            .then((p) => {
                // Add "installed" property to each plugin
                p = p.map((p) => {
                    p.installed = installedPlugins?.find(({ name_for_human }) => name_for_human === p.name_for_human)
                        ? true
                        : false;
                    return p;
                });

                // Add installed plugins to the p array if they're not already there
                installedPlugins?.forEach((plugin) => {
                    if (!p.find(({ name }) => name === plugin.name)) {
                        plugin.installed = true;
                        p.push(plugin);
                    }
                });

                setPlugins(p);
            })
            .catch((error) => {
                alert("Failed to fetch plugins list, due to: " + error);
            });
    }, [installedPlugins, props?.settings?.plugins_server_url]);

    const filteredPlugins = plugins.filter((plugin) =>
        plugin.name_for_human.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredPlugins.length / ITEMS_PER_PAGE);

    const currentPlugins = filteredPlugins.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <>
            <header>
                <span onClick={props.onClose} className="material-symbols-outlined">
                    close
                </span>
                <h1>Plugins</h1>
            </header>
            <div className="dialog-content">
                <TextField
                    label="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ position: "sticky", top: 0, zIndex: 1 }}
                />
                <div className="plugins" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gridGap: "20px" }}>
                    {currentPlugins && currentPlugins.map((plugin, index) => <Plugin key={index} plugin={plugin} />)}
                </div>
                <div style={{ position: "sticky", bottom: 0, zIndex: 1, background: "#fff", padding: "10px 0", borderTop: "1px solid #ccc" }}>
                    <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}>Previous</button>
                    <span>
                        {currentPage} / {totalPages}
                    </span>
                    <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}>Next</button>
                </div>
                <hr />
                <small>
                    When using plugins, be aware that a lengthy system prompt may be sent. Please take the time to
                    thoroughly read and understand the plugin code prior to use.
                </small>
            </div>
        </>
    );
}

export default function PluginManagmentDialog(props) {
    const [page, setPage] = useState(0);

    return (
        <div className="dialog-container" style={{ width: "80%", height: "80%" }}>
            <div className="dialog">
                {page === 0 && (
                    <InstalledPluginsList settings={props.settings} onClose={props.onClose} updatePage={setPage} />
                )}
                {page === 1 && <AddPluginFromURLDialog onClose={props.onClose} updatePage={setPage} />}
            </div>
        </div>
    );
}
