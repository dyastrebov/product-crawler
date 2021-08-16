import { Router, Request, Response } from 'express';
import Scheduler from './utils/scheduler';
import { config } from './crawlers/config';
import dal from './utils/dal';

const jobApi = Router();
const scheduler = new Scheduler();

const crawlerDir = __dirname + '/crawlers';

for (const name in config) {
    const params = config[name];
    scheduler.addJob(String(name), {
        description: String(params.description),
        cmd: String(params.cmd),
        at: String(params.at),
        cwd: crawlerDir,
    });
}

// if this is an empty (new) database, run all jobs immediately
(async () => {
    const isNew = await dal.init();
    if (isNew) {
        for (const name in scheduler.jobs) {
            scheduler.jobs[name].run();
        }
    }
})();

/**
 * Get all jobs
 */
jobApi.get('/', (req, res) => {
    res.json(
        Object.keys(scheduler.jobs)
            .sort()
            .map((name) => {
                const job = scheduler.jobs[name];
                return {
                    name: name,
                    description: job.params.description,
                    at: job.params.at,
                    status: job.process ? 'running' : 'idle',
                };
            })
    );
});

/**
 * Start/stop a job (middleware generator)
 */
function jobAction(action: 'run' | 'stop', req: Request, res: Response) {
    const job = scheduler.jobs[req.params.jobName];

    if (!job) {
        return res.status(404).end(`No job with name '${req.params.jobName}'`);
    }

    try {
        job[action]();
    } catch (err) {
        console.error(
            `Action '${action}' failed on job '${req.params.jobName}'`,
            err
        );
        return res
            .status(500)
            .end(`Action '${action}' failed on job '${req.params.jobName}'`);
    }

    res.send('Ok');
}

jobApi.post('/:jobName/start', (req, res) => jobAction('run', req, res));
jobApi.post('/:jobName/stop', (req, res) => jobAction('stop', req, res));

/**
 * Get job log
 */
jobApi.get('/:jobName/log', (req, res) => {
    const job = scheduler.jobs[req.params.jobName];

    if (!job) {
        return res.status(404).end(`No job with name '${req.params.jobName}'`);
    }

    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.send(job.log);
});

export default jobApi;
