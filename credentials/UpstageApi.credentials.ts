import {
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class UpstageApi implements ICredentialType {
    name = 'upstageApi';
    displayName = 'Upstage API';
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            required: true,
        },
    ];
}
