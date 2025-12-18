import fs from 'fs';
import { URL } from 'url';
import { promisify } from 'util';
import parseDbUrl from 'parse-database-url';
import {
  avoidSSL,
  defaultClientPortMapping,
  defaultConnectionConfig,
  defaultConnectionOptions,
  driverClientMapping,
  knownQueryParams,
} from './constants';
import { DriverClient } from './interfaces';
import type { Connection, DbConfig } from './interfaces';

export async function prepareEnv({
  databaseUrlFile = process.env.NC_DATABASE_URL_FILE ||
    process.env.DATABASE_URL_FILE,
  databaseUrl = process.env.NC_DATABASE_URL || process.env.DATABASE_URL,
} = {}) {
  if (databaseUrlFile) {
    const database_url = await promisify(fs.readFile)(databaseUrlFile, 'utf-8');
    process.env.NC_DB = jdbcToXcUrl(database_url);
  } else if (databaseUrl) {
    process.env.NC_DB = jdbcToXcUrl(databaseUrl);
  }
}

export function getToolDir() {
  return process.env.NC_TOOL_DIR || process.cwd();
}

export function jdbcToXcConfig(url: string): DbConfig {
  // drop the jdbc prefix
  url.replace(/^jdbc:/, '');

  const config = parseDbUrl(url);

  const parsedConfig: Connection = {};

  for (const [key, value] of Object.entries(config)) {
    const fnd = knownQueryParams.find(
      (param) => param.parameter === key || param.aliases.includes(key),
    );
    if (fnd) {
      parsedConfig[fnd.parameter] = value;
    } else {
      parsedConfig[key] = value;
    }
  }

  if (!parsedConfig?.port) {
    parsedConfig.port =
      defaultClientPortMapping[
        driverClientMapping[parsedConfig.driver] || parsedConfig.driver
      ];
  }

  const { driver, ...connectionConfig } = parsedConfig;

  const client = driverClientMapping[driver] || driver;

  if (
    client === 'pg' &&
    !connectionConfig?.ssl &&
    !avoidSSL.includes(connectionConfig.host)
  ) {
    connectionConfig.ssl = true;
  }

  return {
    client: client,
    connection: {
      ...connectionConfig,
    },
  } as DbConfig;
}

export function jdbcToXcUrl(url: string): string {
  // drop the jdbc prefix
  url.replace(/^jdbc:/, '');

  const config = parseDbUrl(url);

  const parsedConfig: Connection = {};

  for (const [key, value] of Object.entries(config)) {
    const fnd = knownQueryParams.find(
      (param) => param.parameter === key || param.aliases.includes(key),
    );
    if (fnd) {
      parsedConfig[fnd.parameter] = value;
    } else {
      parsedConfig[key] = value;
    }
  }

  if (!parsedConfig?.port) {
    parsedConfig.port =
      defaultClientPortMapping[
        driverClientMapping[parsedConfig.driver] || parsedConfig.driver
      ];
  }

  const { driver, host, port, database, user, password, ...extra } =
    parsedConfig;

  const extraParams = [];

  for (const [key, value] of Object.entries(extra)) {
    extraParams.push(`${key}=${encodeURIComponent(value + '')}`);
  }

  const res = `${driverClientMapping[driver] || driver}://${host}${
    port ? `:${port}` : ''
  }?${user ? `u=${encodeURIComponent(user)}&` : ''}${
    password ? `p=${encodeURIComponent(password)}&` : ''
  }${database ? `d=${encodeURIComponent(database)}&` : ''}${extraParams.join(
    '&',
  )}`;

  return res;
}

export function xcUrlToDbConfig(
  urlString: string,
  key = '',
  type?: string,
): DbConfig {
  const url = new URL(urlString);

  let dbConfig: DbConfig;

  if (url.protocol.startsWith('sqlite3')) {
    dbConfig = {
      client: 'sqlite3',
      connection: {
        client: 'sqlite3',
        connection: {
          filename:
            url.searchParams.get('d') || url.searchParams.get('database'),
        },
        database: url.searchParams.get('d') || url.searchParams.get('database'),
      },
    } as any;
  } else {
    const parsedQuery = {};
    for (const [key, value] of url.searchParams.entries()) {
      const fnd = knownQueryParams.find(
        (param) => param.parameter === key || param.aliases.includes(key),
      );
      if (fnd) {
        parsedQuery[fnd.parameter] = value;
      } else {
        parsedQuery[key] = value;
      }
    }

    dbConfig = {
      client: url.protocol.replace(':', '') as DriverClient,
      connection: {
        ...parsedQuery,
        host: url.hostname,
        port: +url.port,
      },
      acquireConnectionTimeout: 600000,
    };

    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      dbConfig.connection.ssl = true;
    }

    if (
      url.searchParams.get('keyFilePath') &&
      url.searchParams.get('certFilePath') &&
      url.searchParams.get('caFilePath')
    ) {
      dbConfig.connection.ssl = {
        keyFilePath: url.searchParams.get('keyFilePath'),
        certFilePath: url.searchParams.get('certFilePath'),
        caFilePath: url.searchParams.get('caFilePath'),
      };
    }
  }

  /* TODO check if this is needed
    if (config && !config.title) {
      config.title =
        url.searchParams.get('t') ||
        url.searchParams.get('title') ||
        this.generateRandomTitle();
    }
  */

  Object.assign(dbConfig, {
    meta: {
      tn: 'nc_evolutions',
      allSchemas:
        !!url.searchParams.get('allSchemas') ||
        !(url.searchParams.get('d') || url.searchParams.get('database')),
      api: {
        prefix: url.searchParams.get('apiPrefix') || '',
        swagger: true,
        type:
          type ||
          ((url.searchParams.get('api') || url.searchParams.get('a')) as any) ||
          'rest',
      },
      dbAlias: url.searchParams.get('dbAlias') || `db${key}`,
      metaTables: 'db',
      migrations: {
        disabled: false,
        name: 'nc_evolutions',
      },
    },
  });

  return dbConfig;
}

export async function metaUrlToDbConfig(urlString): Promise<DbConfig> {
  const url = new URL(urlString);

  let dbConfig: DbConfig;

  if (url.protocol.startsWith('sqlite3')) {
    const db = url.searchParams.get('d') || url.searchParams.get('database');
    dbConfig = {
      client: DriverClient.SQLITE,
      connection: {
        filename: db,
      },
      ...(db === ':memory:'
        ? {
            pool: {
              min: 1,
              max: 1,
              // disposeTimeout: 360000*1000,
              idleTimeoutMillis: 360000 * 1000,
            },
          }
        : {}),
    };
  } else {
    const parsedQuery = {};
    for (const [key, value] of url.searchParams.entries()) {
      const fnd = knownQueryParams.find(
        (param) => param.parameter === key || param.aliases.includes(key),
      );
      if (fnd) {
        parsedQuery[fnd.parameter] = value;
      } else {
        parsedQuery[key] = value;
      }
    }

    dbConfig = {
      client: url.protocol.replace(':', '') as DriverClient,
      connection: {
        ...defaultConnectionConfig,
        ...parsedQuery,
        host: url.hostname,
        port: +url.port,
      },
      acquireConnectionTimeout: 600000,
      ...defaultConnectionOptions,
      ...(url.searchParams.has('search_path')
        ? {
            searchPath: url.searchParams.get('search_path').split(','),
          }
        : {}),
    };

    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      dbConfig.connection.ssl = true;
    }
  }

  url.searchParams.forEach((_value, key) => {
    let value: any = _value;
    if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (/^\d+$/.test(value)) {
      value = +value;
    }
    // todo: implement config read from JSON file or JSON env val read
    if (
      !['password', 'p', 'database', 'd', 'user', 'u', 'search_path'].includes(
        key,
      )
    ) {
      key.split('.').reduce((obj, k, i, arr) => {
        return (obj[k] = i === arr.length - 1 ? value : obj[k] || {});
      }, dbConfig);
    }
  });

  if (
    dbConfig?.connection?.ssl &&
    typeof dbConfig?.connection?.ssl === 'object'
  ) {
    if (dbConfig.connection.ssl.caFilePath && !dbConfig.connection.ssl.ca) {
      dbConfig.connection.ssl.ca = (
        await promisify(fs.readFile)(dbConfig.connection.ssl.caFilePath)
      ).toString();
      delete dbConfig.connection.ssl.caFilePath;
    }
    if (dbConfig.connection.ssl.keyFilePath && !dbConfig.connection.ssl.key) {
      dbConfig.connection.ssl.key = (
        await promisify(fs.readFile)(dbConfig.connection.ssl.keyFilePath)
      ).toString();
      delete dbConfig.connection.ssl.keyFilePath;
    }
    if (dbConfig.connection.ssl.certFilePath && !dbConfig.connection.ssl.cert) {
      dbConfig.connection.ssl.cert = (
        await promisify(fs.readFile)(dbConfig.connection.ssl.certFilePath)
      ).toString();
      delete dbConfig.connection.ssl.certFilePath;
    }
  }

  // Check for read-write split configuration for MySQL
  if (
    (dbConfig.client === DriverClient.MYSQL ||
      dbConfig.client === DriverClient.MYSQL_LEGACY) &&
    process.env.WRITER_DB_SCHEMA &&
    process.env.READER_DB_SCHEMA
  ) {
    // Writer connection config
    const writerConfig = {
      ...defaultConnectionConfig,
      host: process.env.WRITER_DB_HOSTNAME || dbConfig.connection.host,
      port: +(process.env.WRITER_DB_PORT || dbConfig.connection.port || 3306),
      user: process.env.WRITER_DB_USERNAME || dbConfig.connection.user,
      password: process.env.WRITER_DB_PASSWORD || dbConfig.connection.password,
      database: process.env.WRITER_DB_SCHEMA || dbConfig.connection.database,
    };

    // Reader connection config
    const readerConfig = {
      ...defaultConnectionConfig,
      host: process.env.READER_DB_HOSTNAME || dbConfig.connection.host,
      port: +(process.env.READER_DB_PORT || dbConfig.connection.port || 3306),
      user: process.env.READER_DB_USERNAME || dbConfig.connection.user,
      password: process.env.READER_DB_PASSWORD || dbConfig.connection.password,
      database: process.env.READER_DB_SCHEMA || dbConfig.connection.database,
    };

    // Writer pool config
    const writerPool = {
      min: +(process.env.WRITER_DB_POOL_MIN || 1),
      max: +(process.env.WRITER_DB_POOL_MAX || 10),
      acquireTimeoutMillis: +(
        process.env.WRITER_DB_POOL_ACQUIRE || 30000
      ),
      idleTimeoutMillis: +(process.env.WRITER_DB_POOL_IDLE || 10000),
    };

    // Reader pool config
    const readerPool = {
      min: +(process.env.READER_DB_POOL_MIN || 1),
      max: +(process.env.READER_DB_POOL_MAX || 10),
      acquireTimeoutMillis: +(
        process.env.READER_DB_POOL_ACQUIRE || 30000
      ),
      idleTimeoutMillis: +(process.env.READER_DB_POOL_IDLE || 10000),
    };

    // Set up read-write split configuration
    dbConfig.connection = writerConfig; // Default to writer for backward compatibility
    dbConfig.pool = writerPool;
    dbConfig.reader = {
      connection: readerConfig,
      pool: readerPool,
    };
  }

  return dbConfig;
}
