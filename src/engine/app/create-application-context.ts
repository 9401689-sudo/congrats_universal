import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";

import type { ChannelGateway } from "../channel/channel-gateway.js";
import type { AppConfig } from "../../config/env.js";
import type { DeliveryTransport } from "../delivery/delivery-transport.js";
import type { PaymentService } from "../payments/payment-service.js";
import type { PaymentsRepository } from "../payments/payments-repository.js";
import type { DeliveriesRepository } from "../repositories/deliveries-repository.js";
import type { DocumentsRepository } from "../repositories/documents-repository.js";
import type { RequestsRepository } from "../repositories/requests-repository.js";
import type { UsersRepository } from "../repositories/users-repository.js";
import type { VariantsRepository } from "../repositories/variants-repository.js";
import type { PreviewRenderer } from "../rendering/preview-renderer.js";
import { PythonRendererWorkerClient } from "../rendering/python-renderer-worker-client.js";
import type { RenderingAdapter } from "../rendering/rendering-adapter.js";
import type { BotRuntimeDefinition } from "../runtime/bot-runtime-definition.js";
import type { SessionStore } from "../state/session-store.js";
import type { TelegramGateway } from "../telegram/telegram-gateway.js";
import { createPgPool } from "../../infra/postgres.js";
import { createRedisClient, type RedisClient } from "../../infra/redis.js";
import { InMemoryDocumentsRepository } from "../../adapters/documents/in-memory-documents-repository.js";
import { PostgresDocumentsRepository } from "../../adapters/documents/postgres-documents-repository.js";
import { BotApiDeliveryTransport } from "../../adapters/deliveries/bot-api-delivery-transport.js";
import { FakeRenderingAdapter } from "../../adapters/deliveries/fake-rendering-adapter.js";
import { InMemoryDeliveriesRepository } from "../../adapters/deliveries/in-memory-deliveries-repository.js";
import { LocalFileRenderingAdapter } from "../../adapters/deliveries/local-file-rendering-adapter.js";
import { LoggingDeliveryTransport } from "../../adapters/deliveries/logging-delivery-transport.js";
import { MaxDeliveryTransport } from "../../adapters/deliveries/max-delivery-transport.js";
import { PostgresDeliveriesRepository } from "../../adapters/deliveries/postgres-deliveries-repository.js";
import { PythonRenderDocAdapter } from "../../adapters/deliveries/python-render-doc-adapter.js";
import { FakePaymentService } from "../../adapters/payments/fake-payment-service.js";
import { InMemoryPaymentsRepository } from "../../adapters/payments/in-memory-payments-repository.js";
import { PostgresPaymentsRepository } from "../../adapters/payments/postgres-payments-repository.js";
import { YookassaPaymentService } from "../../adapters/payments/yookassa-payment-service.js";
import { LoggingChannelGateway } from "../../adapters/channel/logging-channel-gateway.js";
import { MaxApiChannelGateway } from "../../adapters/max/max-api-channel-gateway.js";
import { InMemoryRequestsRepository } from "../../adapters/requests/in-memory-requests-repository.js";
import { PostgresRequestsRepository } from "../../adapters/requests/postgres-requests-repository.js";
import { createSessionStore } from "../../adapters/session/create-session-store.js";
import { BotApiTelegramGateway } from "../../adapters/telegram/bot-api-telegram-gateway.js";
import { LoggingTelegramGateway } from "../../adapters/telegram/logging-telegram-gateway.js";
import { InMemoryUsersRepository } from "../../adapters/users/in-memory-users-repository.js";
import { PostgresUsersRepository } from "../../adapters/users/postgres-users-repository.js";
import { createVariantsRepository } from "../../adapters/variants/create-variants-repository.js";
import { PythonPreviewRenderer } from "../../adapters/variants/python-preview-renderer.js";

export type ApplicationContext = {
  botRuntime: {
    campaignId: string;
    channel: "max" | "telegram";
    id: string;
    webhookSecret?: string;
  };
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
  telegramGateway: ChannelGateway;
  usersRepository: UsersRepository;
  variantsRepository: VariantsRepository;
  paymentService: PaymentService;
  paymentsRepository: PaymentsRepository;
  previewRenderer?: PreviewRenderer;
};

export function createApplicationContext(
  config: AppConfig,
  runtime: BotRuntimeDefinition,
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

  const botToken = runtime.botToken ?? runtime.telegramBotToken;
  const telegramGateway: ChannelGateway =
    runtime.channel === "telegram"
      ? botToken
        ? new BotApiTelegramGateway(botToken)
        : new LoggingTelegramGateway(logger)
      : botToken
        ? new MaxApiChannelGateway(botToken)
        : new LoggingChannelGateway(logger, "max");
  const deliveryTransport =
    runtime.channel === "telegram" && botToken
      ? new BotApiDeliveryTransport(botToken)
      : runtime.channel === "max" && botToken
        ? new MaxDeliveryTransport(botToken)
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
    runtime.yookassaShopId && runtime.yookassaSecretKey
      ? new YookassaPaymentService(
          runtime.yookassaShopId,
          runtime.yookassaSecretKey,
          runtime.yookassaReturnUrl
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
    botRuntime: {
      campaignId: runtime.campaignId,
      channel: runtime.channel,
      id: runtime.id,
      webhookSecret: runtime.webhookSecret
    },
    configSummary: {
      hasDatabase: Boolean(config.databaseUrl),
      hasRedis: Boolean(config.redisUrl),
      hasTelegramBotToken: Boolean(botToken),
      hasYookassa: Boolean(
        runtime.yookassaShopId && runtime.yookassaSecretKey
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
