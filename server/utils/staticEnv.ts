import express, { Request, Response } from 'express';

/**
 * Returns a middleware function for serving React client files.
 *
 * @remarks
 * This function creates a middleware for serving "static" content.
 * The content may be either "pre-built" (when NODE_ENV == "production"),
 * or built dynamically (for any other NODE_ENV value)
 *
 * @param port - port number for running development server (only for develoment,
 * must be different from the main application port)
 */
function staticEnv(port: number) {
    if (process.argv[1].match(/[\/\\]build$/)) {
        // in "production" - just serve the files which must already be in the client's build directory:
        return express.static(__dirname + '/../../../client/build');
    } else {
        // we are in "developer" mode - run react-scripts to serve "static" server on port="port":
        process.env.HOST = 'localhost';
        process.env.PORT = String(port);
        process.env.BROWSER = 'none';

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { spawn } = require('child_process');
        spawn(`npm run start --prefix client`, [], {
            shell: true,
            stdio: 'inherit',
        });

        // now we need to proxy all request back to that another "development" server from this app
        // Note: this uses 'require' instead of 'import' to avoid including unnecessary lib-s on production
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const httpProxy = require('http-proxy');
        const proxy = httpProxy.createProxyServer();
        return async (req: Request, res: Response): Promise<Response> => {
            return proxy.web(req, res, { target: 'http://localhost:' + port });
        };
    }
}

export default staticEnv;
