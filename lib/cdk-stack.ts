import * as cdk from "aws-cdk-lib"
import * as apigeteway from "aws-cdk-lib/aws-apigateway"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { Topic } from "aws-cdk-lib/aws-sns"
import { SqsSubscription } from "aws-cdk-lib/aws-sns-subscriptions"
import { Queue } from "aws-cdk-lib/aws-sqs"

export class CdkStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props)

		//SQS
		const queue: Queue = new Queue(this, "CDKQueue", {
			queueName: "CDK"
		})

		//SNS
		const topic: Topic = new Topic(this, "CDKTopic", {
			displayName: "CDK",
			topicName: "CDK",
			fifo: false
		})

		topic.addSubscription(new SqsSubscription(queue))

		//dynamo
		const cdkTable = new dynamodb.Table(this, "cdkTable", {
			partitionKey: {
				name: "itemId",
				type: dynamodb.AttributeType.STRING
			}
		})

		//lambda
		const getItem = new lambda.Function(this, "indexItem", {
			code: new lambda.AssetCode("./src/getItem"),
			handler: "getItem.handler",
			runtime: lambda.Runtime.NODEJS_16_X,
			environment: {
				TABLE_NAME: cdkTable.tableName,
				PRIMARY_KEY: "itemId"
			}
		})

		const createItem = new lambda.Function(this, "indexCreateItem", {
			code: new lambda.AssetCode("./src/createItem"),
			handler: "createItem.handler",
			runtime: lambda.Runtime.NODEJS_16_X,
			environment: {
				TABLE_NAME: cdkTable.tableName,
				PRIMARY_KEY: "itemId"
			}
		})
		cdkTable.grantReadData(getItem)
		cdkTable.grantReadWriteData(createItem)

		//lambda for sns sqs
		const createMessage = new lambda.Function(this, "indexCreateMessage", {
			code: new lambda.AssetCode("./src/createMessage"),
			handler: "createMessage.handler",
			runtime: lambda.Runtime.NODEJS_16_X,
			environment: {
				TOPIC_ARN: topic.topicArn
			}
		})

		const addMessageInDinamo = new lambda.Function(this, "indexAddMessageInDinamo", {
			code: new lambda.AssetCode("./src/addInDynamo"),
			handler: "addInDynamo.handler",
			runtime: lambda.Runtime.NODEJS_16_X,
			environment: {
				TABLE_NAME: cdkTable.tableName
			}
		})


		const eventSource = new lambdaEventSources.SqsEventSource(queue)
		addMessageInDinamo.addEventSource(eventSource)
		//api
		const api = new apigeteway.RestApi(this, "apiItem", {
			restApiName: "testCDK_API"
		})

		const textApi = api.root.addResource("text")
		const getItemApi = new apigeteway.LambdaIntegration(getItem)
		textApi.addMethod("GET", getItemApi)

		const itemModel = api.addModel("UserModel", {
			schema: {
				type: apigeteway.JsonSchemaType.OBJECT,
				properties: {
					title: {
						type: apigeteway.JsonSchemaType.STRING
					}
				},
				required: ["title"]
			}
		})

		const createItemApi = new apigeteway.LambdaIntegration(createItem)
		textApi.addMethod("POST", createItemApi, {
			requestModels: {
				"application/json": itemModel
			}
		})

		const messageModel = api.addModel("MessageModel", {
			schema: {
				type: apigeteway.JsonSchemaType.OBJECT,
				properties: {
					message: {
						type: apigeteway.JsonSchemaType.STRING
					}
				},
				required: ["message"]
			}
		})

		const snsAPI = api.root.addResource("sns")
		const createMessageApi = new apigeteway.LambdaIntegration(createMessage)
		snsAPI.addMethod("POST", createMessageApi, {
			requestModels: {
				"application/json": messageModel
			}
		})
	}
}
