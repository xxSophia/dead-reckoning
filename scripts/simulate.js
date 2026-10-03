const { server } = require('../src/server');
const { io } = require('socket.io-client');
const { generateCrisis } = require('../src/game');

const port = 3107;
const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));
const emit = (client, event, data) =>
  new Promise((resolve) => client.emit(event, data, resolve));

const waitFor = (check, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();

    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for server state'));
      }
    }, 20);
  });

server.listen(port, async () => {
  const url = `http://localhost:${port}`;

  const clients = [0, 1, 2, 3].map(() =>
    io(url, {
      transports: ['websocket'],
      forceNew: true
    })
  );

  let latest = null;
  let code;
  let host;
  let seed;

  clients[0].on('state', (state) => {
    latest = state;
  });

  try {
    let result = await emit(clients[0], 'create', {
      nick: 'Alpha',
      seed: 'SIM'
    });

    code = result.code;
    host = result.token;

    for (let i = 1; i < 4; i++) {
      result = await emit(clients[i], 'join', {
        nick: `Crew${i}`,
        code
      });

      clients[i].token = result.token;
    }

    result = await emit(clients[0], 'start', {
      code,
      token: host
    });

    if (!result.ok) {
      throw new Error(result.error || 'start failed');
    }

    await waitFor(
      () =>
        latest?.state?.status === 'playing' &&
        latest?.state?.depth === 1
    );

    seed = latest.state.seed;

    for (let depth = 1; depth <= 10; depth++) {
      await waitFor(
        () =>
          latest?.state?.status === 'playing' &&
          latest?.state?.depth === depth
      );

      const solution = generateCrisis(seed, depth).solution;
      await wait(750);
      const actorIndex = (depth - 1) % 4;
      const actor = clients[actorIndex];
      const actorToken = actorIndex === 0 ? host : actor.token;

      result = await emit(actor, 'submit', {
        code,
        token: actorToken,
        actions: solution
      });

      if (!result.ok) {
        throw new Error(result.error || 'submit failed');
      }

      if (depth < 10) {
        await waitFor(
          () =>
            latest?.state?.status === 'playing' &&
            latest?.state?.depth === depth + 1
        );
      } else {
        await waitFor(
          () => latest?.state?.status === 'won'
        );
      }
    }

    if (latest?.state?.status !== 'won') {
      throw new Error(
        `simulation did not finish: ${latest?.state?.status}`
      );
    }

    if ('solution' in (latest.state.round || {})) {
      throw new Error('private solution leaked to client');
    }

    console.log(
      'PASS: 4 clients completed 10 depths; hull',
      latest.state.hull,
      'room',
      code
    );
  } catch (error) {
    console.error('FAIL:', error);
    process.exitCode = 1;
  } finally {
    clients.forEach((client) => client.close());
    server.close();
  }
});