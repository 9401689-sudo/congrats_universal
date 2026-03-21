import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";

import type { AppConfig } from "../../config/env.js";
import type { PreviewRenderer } from "../../engine/rendering/preview-renderer.js";
import { PythonRendererWorkerClient } from "../../engine/rendering/python-renderer-worker-client.js";
import type { RenderingAdapter } from "../../engine/rendering/rendering-adapter.js";
import { createPgPool } from "../../infra/postgres.js";
import { createRedisClient, type RedisClient } from "../../infra/redis.js";
import { InMemoryDocumentsRepository } from "../documents/in-memory-documents-repository.js";
import { PostgresDocumentsRepository } from "../documents/postgres-documents-repository.js";
import type { DocumentsRepository } from "../documents/documents-repository.js";
import { BotApiDeliveryTransport } from "../deliveries/bot-api-delivery-transport.js";
import { FakeRenderingAdapter } from "../deliveries/fake-rendering-adapter.js";
import { InMemoryDeliveriesRepository } from "../deliveries/in-memory-deliveries-repository.js";
import { LocalFileRenderingAdapter } from "../deliveries/local-file-rendering-adapter.js";
import { LoggingDeliveryTransport } from "../deliveries/logging-delivery-transport.js";
import { PostgresDeliveriesRepository } from "../deliveries/postgres-deliveries-repository.js";
import { PythonRenderDocAdapter } from "../deliveries/python-render-doc-adapter.js";
import type { DeliveryTransport } from "../deliveries/delivery-transport.js";
import type { DeliveriesRepository } from "../deliveries/deliveries-repository.js";
import { InMemoryRequestsRepository } from "../requests/in-memory-requests-repository.js";
import { PostgresRequestsRepository } from "../requests/postgres-requests-repository.js";
import type { RequestsRepository } from "../requests/requests-repository.js";
import { FakePaymentService } from "../payments/fake-payment-service.js";
import { InMemoryPaymentsRepository } from "../payments/in-memory-payments-repository.js";
import type { PaymentService } from "../payments/payment-service.js";
import type { PaymentsRepository } from "../payments/payments-repository.js";
import { PostgresPaymentsRepository } from "../payments/postgres-payments-repository.js";
import { YookassaPaymentService } from "../payments/yookassa-payment-service.js";
import { createSessionStore } from "../session/create-session-store.js";
import type { SessionStore } from "../session/session-store.js";
import { BotApiTelegramGateway } from "../telegram/bot-api-telegram-gateway.js";
import { LoggingTelegramGateway } from "../telegram/logging-telegram-gateway.js";
import type { TelegramGateway } from "../telegram/telegram-gateway.js";
import { InMemoryUsersRepository } from "../users/in-memory-users-repository.js";
import { PostgresUsersRepository } from "../users/postgres-users-repository.js";
import type { UsersRepository } from "../users/users-repository.js";
import { createVariantsRepository } from "../variants/create-variants-repository.js";
import { PythonPreviewRenderer } from "../variants/python-preview-renderer.js";
import type { VariantsRepository } from "../variants/variants-repository.js";

export type ApplicationContext = {
  configSummary: {
    hasDatabase: boolean;
    hasRedis: boolean;
    hasTelegramBotToken: boolean;
    hasYookassa: boolean;
  };
  deliveryTransport: DeliveryTransport;
  deliveriesRepository: DeliveriesRepository;
  documentsRepository: DocumentsRepository;
  pgPool?: Pool;
  redisClient?: RedisClient;
  renderingAdapter: RenderingAdapter;
  requestsRepository: RequestsRepository;
  sessionStore: SessionStore;
  telegramGateway: TelegramGateway;
  usersRepository: UsersRepository;
  variantsRepository: VariantsRepository;
  paymentService: PaymentService;
  paymentsRepository: PaymentsRepository;
  previewRenderer?: PreviewRenderer;
};

export function createApplicationContext(
  config: AppConfig,
  logger: FastifyBaseLogger
): ApplicationContext {
  const pgPool = config.databaseUrl ? createPgPool(config.databaseUrl) : undefined;
  const redisClient = config.redisUrl ? createRedisClient(config.redisUrl) : undefined;

  const usersRepository = pgPool
    ? new PostgresUsersRepository(pgPool)
    : new InMemoryUsersRepository();

  const requestsRepository = pgPool
    ? new PostgresRequestsRepository(pgPool)
    : new InMemoryRequestsRepository();
  const paymentsRepository = pgPool
    ? new PostgresPaymentsRepository(pgPool)
    : new InMemoryPaymentsRepository();
  const documentsRepository = pgPool
    ? new PostgresDocumentsRepository(pgPool)
    : new InMemoryDocumentsRepository();
  const deliveriesRepository = pgPool
    ? new PostgresDeliveriesRepository(pgPool)
    : new InMemoryDeliveriesRepository();

  const telegramGateway = config.telegramBotToken
    ? new BotApiTelegramGateway(config.telegramBotToken)
    : new LoggingTelegramGateway(logger);
  const deliveryTransport = config.telegramBotToken
    ? new BotApiDeliveryTransport(config.telegramBotToken)
    : new LoggingDeliveryTransport(logger);
  const pythonRendererWorkerClient =
    config.pythonRendererBin && config.pythonRendererScriptPath
      ? new PythonRendererWorkerClient({
          pythonBin: config.pythonRendererBin,
          scriptPath: config.pythonRendererScriptPath
        })
      : undefined;
  const renderingAdapter =
    pythonRendererWorkerClient
      ? new PythonRenderDocAdapter({
          outputDir: config.renderOutputDir,
          templatesDir: config.pythonRendererTemplatesDir,
          workerClient: pythonRendererWorkerClient
        })
      : config.renderOutputDir
        ? new LocalFileRenderingAdapter(config.renderOutputDir)
        : new FakeRenderingAdapter();
  const paymentService =
    config.yookassaShopId && config.yookassaSecretKey && config.yookassaReturnUrl
      ? new YookassaPaymentService(
          config.yookassaShopId,
          config.yookassaSecretKey,
          config.yookassaReturnUrl
        )
      : new FakePaymentService();
  const previewRenderer =
    pythonRendererWorkerClient
      ? new PythonPreviewRenderer({
          outputDir: config.renderOutputDir,
          templatesDir: config.pythonRendererTemplatesDir,
          workerClient: pythonRendererWorkerClient
        })
      : undefined;

  return {
    configSummary: {
      hasDatabase: Boolean(config.databaseUrl),
      hasRedis: Boolean(config.redisUrl),
      hasTelegramBotToken: Boolean(config.telegramBotToken),
      hasYookassa: Boolean(
        config.yookassaShopId && config.yookassaSecretKey && config.yookassaReturnUrl
      )
    },
    deliveryTransport,
    paymentService,
    paymentsRepository,
    previewRenderer,
    documentsRepository,
    deliveriesRepository,
    pgPool,
    redisClient,
    renderingAdapter,
    requestsRepository,
    sessionStore: createSessionStore(redisClient),
    telegramGateway,
    usersRepository,
    variantsRepository: createVariantsRepository(redisClient)
  };
}
