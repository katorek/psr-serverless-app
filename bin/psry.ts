#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {PsryStack} from '../lib/psry-stack';

const app = new cdk.App();
new PsryStack(app, 'PsryStack', {
    env: {
        account: '658824853647',
        region: 'us-east-1'
    }
});

app.synth();
