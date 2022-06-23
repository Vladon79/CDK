import * as cdk from "aws-cdk-lib"
import * as apigeteway from "aws-cdk-lib/aws-apigateway"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { RemovalPolicy } from "aws-cdk-lib"

export class CdkStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props)

		//dynamo
		const cdkTable = new dynamodb.Table(this, "cdkTable", {
			partitionKey: {
				name: "itemId",
				type: dynamodb.AttributeType.STRING
			}
		})

		//lambda
		const getItem = new lambda.Function(this, "indexItem", {
			code: new lambda.AssetCode("./src"),
			handler: "getItem.handler",
			runtime: lambda.Runtime.NODEJS_16_X,
			environment: {
				TADLE_NAME: cdkTable.tableName,
				PRIMARY_KEY: "itemId"
			}
		})

		const createItem = new lambda.Function(this, "indexCreateItem", {
			code: new lambda.AssetCode("./src"),
			handler: "createItem.handler",
			runtime: lambda.Runtime.NODEJS_16_X,
			// environment: {
			// 	TADLE_NAME: cdkTable.tableName,
			// 	PRIMARY_KEY: "itemId"
			// }
		})

		const createMessage = new lambda.Function(this, "indexCreateMessage", {
			code: new lambda.AssetCode("./src"),
			handler: "createMessage.handler",
			runtime: lambda.Runtime.NODEJS_16_X,
			environment: {
				TADLE_NAME: cdkTable.tableName,
				PRIMARY_KEY: "itemId"
			}
		})

		cdkTable.grantReadData(getItem)
		cdkTable.grantReadWriteData(createItem)

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

		const snsAPI = api.root.addResource("sns")
		const createMessageApi = new apigeteway.LambdaIntegration(createMessage)
		snsAPI.addMethod("POST", createMessageApi)
	}
}
