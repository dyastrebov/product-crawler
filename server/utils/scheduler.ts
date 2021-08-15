/**
 * Abstract scheduler for running multiple jobs in separate processes
 */
import child_process from 'child_process';
import { CronJob } from 'cron';
import treeKill from 'tree-kill';

export type JobParams = {
    description: string;
    cwd?: string;
    cmd: string;
    at: string;
};

export class Job {
    name: string;
    params: JobParams;
    process: child_process.ChildProcessWithoutNullStreams | null = null;
    cronJob: CronJob | null = null;
    log = '';

    constructor(name: string, params: JobParams) {
        this.name = name;
        this.params = params;
        this.update(params);
    }

    stop() {
        if (this.process) {
            if (!this.process.killed) treeKill(this.process.pid);
            this.process = null;
        }

        return this;
    }

    run() {
        if (this.process) return;
        try {
            const options = {
                shell: true,
                cwd: this.params.cwd,
                env: Object.assign({ JOB_NAME: this.name }, process.env),
            };

            let lastLf = -1;
            const log = (text: string): void => {
                this.log += text;
                const lfPos = this.log.lastIndexOf('\n');
                if (lfPos > lastLf) {
                    this.log
                        .substring(lastLf + 1, lfPos)
                        .split('\n')
                        .forEach((s) => console.log(`Job ${this.name} ${s}`));
                    lastLf = lfPos;
                }
            };

            console.log(`Job ${this.name}::executing ${this.params.cmd}`);
            this.process = child_process.spawn(this.params.cmd, [], options);

            if (!this.process) throw 'Process creation failed';
            this.log = '';
            this.process.stdout.setEncoding('utf8');
            this.process.stderr.setEncoding('utf8');
            this.process.stdout.on('data', (data) => log(String(data)));
            this.process.stderr.on('data', (data) => log(String(data)));
            this.process.on('error', (error) => {
                console.error(`Job ${this.name}::error ${error.toString()}`);
                this.process = null;
            });
            this.process.on('close', (code) => {
                console[code !== 0 ? 'error' : 'log'](
                    `Job ${this.name}::process exited with code ${code}`
                );
                this.stop();
            });
        } catch (ex) {
            console.error(
                `Failed to start job "${this.name}" with command "${this.params.cmd}"`
            );
            console.error(ex);
            this.stop();
        }

        return this;
    }

    update(params: JobParams) {
        this.params = params;
        if (this.cronJob) this.cronJob.stop();

        try {
            this.cronJob = new CronJob({
                cronTime: params.at,
                onTick: () => this.run(),
                start: true,
            });
        } catch (ex) {
            console.error('cron pattern is not valid');
            console.error(ex);
        }

        return this;
    }
}

export default class Scheduler {
    jobs: { [index: string]: Job } = {};

    addJob(name: string, params: JobParams): void {
        if (this.jobs[name]) throw new Error(`Job '${name}' already exists.`);
        this.jobs[name] = new Job(name, params);
    }

    deleteJob(name: string): void {
        const job = this.jobs[name];
        if (!job) return;
        job.stop();
        delete this.jobs[name];
    }
}
