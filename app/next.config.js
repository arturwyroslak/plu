module.exports = {
    exportPathMap: async function (defaultPathMap) {
        return Object.assign(
            {},
            ...Object.keys(defaultPathMap).map((key) => {
                return {
                    [key === "/" ? "/index" : key]: {
                        page: key,
                    },
                };
            })
        );
    },
    trailingSlash: true,
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Access-Control-Allow-Origin',
                        value: '*'
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT'
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
                    }
                ]
            }
        ]
    }
};
