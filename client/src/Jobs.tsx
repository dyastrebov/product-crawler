import { useEffect, useState } from 'react';

type JobDesc = {
    name: string;
    description: string;
    at: string;
    status: string;
};

function Jobs() {
    let [jobs, setJobs] = useState<Array<JobDesc>>([]);

    function getJobs() {
        fetch('jobs')
            .then((res) => res.json())
            .then((res) => setJobs(res));
    }

    async function jobAction(name: string, action: 'start' | 'stop') {
        try {
            await fetch(`jobs/${name}/${action}`, { method: 'POST' });
        } catch (err) {
            alert(err);
        }
        getJobs();
    }

    function actionHref(job: JobDesc) {
        return job.status == 'running' ? (
            <a href='' onClick={() => jobAction(job.name, 'stop')}>
                stop
            </a>
        ) : (
            <a href='' onClick={() => jobAction(job.name, 'start')}>
                start
            </a>
        );
    }
    useEffect(getJobs, []);

    return (
        <div>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Crawl schedule</th>
                        <th>Status</th>
                        <th>Log</th>
                    </tr>
                </thead>
                <tbody>
                    {jobs &&
                        jobs.map((job) => (
                            <tr key={job.name}>
                                <td>{job.name}</td>
                                <td>{job.description}</td>
                                <td>{job.at}</td>
                                <td>
                                    {job.status} ({actionHref(job)})
                                </td>
                                <td>
                                    <a
                                        href={`jobs/${job.name}/log`}
                                        target='_blank'
                                        rel='noreferrer'
                                    >
                                        Open
                                    </a>
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}

export default Jobs;
