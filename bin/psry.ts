#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {PsrStack} from '../lib/psr-stack';

const app = new cdk.App();
new PsrStack(app, 'PsryStack', {
    env: {
        account: '658824853647',
        region: 'us-east-1'
    }
});

app.synth();
