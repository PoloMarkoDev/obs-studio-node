import 'mocha'
import { expect } from 'chai'
import * as osn from '../osn';
import { logInfo, logEmptyLine } from '../util/logger';
import { OBSHandler, IVec2 } from '../util/obs_handler';
import { ETestErrorMsg, GetErrorMessage } from '../util/error_messages';
import { IInput, ISettings, ITimeSpec } from '../osn';
import { deleteConfigFiles, sleep } from '../util/general';
import { EOBSInputTypes, EOBSOutputSignal, EOBSOutputType } from '../util/obs_enums';
import { ERecordingFormat, ERecordingQuality } from '../osn';
import { EFPSType } from '../osn';
import * as inputSettings from '../util/input_settings';

import path = require('path');

const testName = 'osn-dual-output';

describe(testName, () => {
    let obs: OBSHandler;
    let hasTestFailed: boolean = false;
    let context: osn.IVideo;
    let sceneName: string = 'test_scene';
    let sourceName: string = 'test_source';

    // Initialize OBS process
    before(async() => {
        logInfo(testName, 'Starting ' + testName + ' tests');
        deleteConfigFiles();
        obs = new OBSHandler(testName);
        context = osn.VideoFactory.create();
        const firstVideoInfo: osn.IVideoInfo = {
            fpsNum: 60,
            fpsDen: 1,
            baseWidth: 1920,
            baseHeight: 1080,
            outputWidth: 1280,
            outputHeight: 720,
            outputFormat: osn.EVideoFormat.NV12,
            colorspace: osn.EColorSpace.CS709,
            range: osn.ERangeType.Full,
            scaleType: osn.EScaleType.Bilinear,
            fpsType: osn.EFPSType.Fractional
        };
        context.video = firstVideoInfo;

        obs.instantiateUserPool(testName);

        // Reserving user from pool
        await obs.reserveUser();
    });

    // Shutdown OBS process
    after(async function() {
        context.destroy();
        // Releasing user got from pool
        await obs.releaseUser();

        obs.shutdown();

        if (hasTestFailed === true) {
            logInfo(testName, 'One or more test cases failed. Uploading cache');
            await obs.uploadTestCache();
        }

        obs = null;
        deleteConfigFiles();
        logInfo(testName, 'Finished ' + testName + ' tests');
        logEmptyLine();
    });

    beforeEach(function() {
        // Creating scene
        const scene = osn.SceneFactory.create(sceneName); 

        // Checking if scene was created correctly
        expect(scene).to.not.equal(undefined, GetErrorMessage(ETestErrorMsg.CreateScene, sceneName));
        expect(scene.id).to.equal('scene', GetErrorMessage(ETestErrorMsg.SceneId, sceneName));
        expect(scene.name).to.equal(sceneName, GetErrorMessage(ETestErrorMsg.SceneName, sceneName));
        expect(scene.type).to.equal(osn.ESourceType.Scene, GetErrorMessage(ETestErrorMsg.SceneType, sceneName));

        // Creating input source
        const source = osn.InputFactory.create(EOBSInputTypes.ImageSource, sourceName);

        // Checking if source was created correctly
        expect(source).to.not.equal(undefined, GetErrorMessage(ETestErrorMsg.CreateInput, EOBSInputTypes.ImageSource));
        expect(source.id).to.equal(EOBSInputTypes.ImageSource, GetErrorMessage(ETestErrorMsg.InputId, EOBSInputTypes.ImageSource));
        expect(source.name).to.equal(sourceName, GetErrorMessage(ETestErrorMsg.InputName, EOBSInputTypes.ImageSource));
    });

    afterEach(function() {
        const scene = osn.SceneFactory.fromName(sceneName);
        scene.release();

        if (this.currentTest.state == 'failed') {
            hasTestFailed = true;
        }
    });
 
    it('Start Dual Output with advanced recording', async () => {
        const secondContext = osn.VideoFactory.create();

        const secondVideoInfo: osn.IVideoInfo = {
            fpsNum: 60,
            fpsDen: 2,
            baseWidth: 1080,
            baseHeight: 1920,
            outputWidth: 1080,
            outputHeight: 1920,
            outputFormat: osn.EVideoFormat.I420,
            colorspace: osn.EColorSpace.CS709,
            range: osn.ERangeType.Full,
            scaleType: osn.EScaleType.Lanczos,
            fpsType: EFPSType.Fractional
        };
        secondContext.video = secondVideoInfo;

        const recording = osn.AdvancedRecordingFactory.create();
        recording.path = path.join(path.normalize(__dirname), '..', 'osnData');
        recording.format = ERecordingFormat.MP4;
        recording.useStreamEncoders = false;
        recording.videoEncoder = osn.VideoEncoderFactory.create('obs_x264', 'video-encoder');
        recording.overwrite = false;
        recording.noSpace = false;
        recording.video = context;
        const track1 = osn.AudioTrackFactory.create(160, 'track1');
        osn.AudioTrackFactory.setAtIndex(track1, 1);
        recording.signalHandler = (signal) => {obs.signals.push(signal)};

        recording.start();

        let signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Start);

        if (signalInfo.signal == EOBSOutputSignal.Stop) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputDidNotStart, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Start, GetErrorMessage(ETestErrorMsg.RecordingOutput));

            const recording2 = osn.AdvancedRecordingFactory.create();
            recording2.path = path.join(path.normalize(__dirname), '..', 'osnData');
            recording2.format = ERecordingFormat.MP4;
            recording2.useStreamEncoders = false;
            recording2.videoEncoder = osn.VideoEncoderFactory.create('obs_x264', 'video-encoder');
            recording2.overwrite = false;
            recording2.noSpace = false;
            recording2.video = secondContext;
            const track2 = osn.AudioTrackFactory.create(160, 'track2');
            osn.AudioTrackFactory.setAtIndex(track2, 1);
            recording2.signalHandler = (signal) => {obs.signals.push(signal)};
    
            recording2.start();
    
            let signalInfo2 = await obs.getNextSignalInfo(
                EOBSOutputType.Recording, EOBSOutputSignal.Start);
    
            if (signalInfo2.signal == EOBSOutputSignal.Stop) {
                throw Error(GetErrorMessage(
                    ETestErrorMsg.RecordOutputDidNotStart, signalInfo.code.toString(), signalInfo.error));
            }
    
            expect(signalInfo.type).to.equal(
                EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
            expect(signalInfo.signal).to.equal(
                EOBSOutputSignal.Start, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        await sleep(500);

        recording.stop();
        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stopping);
        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stopping, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stop);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stop, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Wrote);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Wrote, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        recording2.stop();

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stopping);
        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stopping, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stop);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stop, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Wrote);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Wrote, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        osn.AdvancedRecordingFactory.destroy(recording);

        osn.AdvancedRecordingFactory.destroy(recording2);

        secondContext.destroy();
    });

    it('Start Dual Output with recording and scene items', async () => {
        const returnSource = osn.Global.getOutputSource(0);
        const secondContext = osn.VideoFactory.create();

        const secondVideoInfo: osn.IVideoInfo = {
            fpsNum: 60,
            fpsDen: 2,
            baseWidth: 1080,
            baseHeight: 1920,
            outputWidth: 1080,
            outputHeight: 1920,
            outputFormat: osn.EVideoFormat.I420,
            colorspace: osn.EColorSpace.CS709,
            range: osn.ERangeType.Full,
            scaleType: osn.EScaleType.Lanczos,
            fpsType: EFPSType.Fractional
        };
        secondContext.video = secondVideoInfo;

        const recording = osn.AdvancedRecordingFactory.create();
        recording.path = path.join(path.normalize(__dirname), '..', 'osnData');
        recording.format = ERecordingFormat.MP4;
        recording.useStreamEncoders = false;
        recording.videoEncoder = osn.VideoEncoderFactory.create('obs_x264', 'video-encoder');
        recording.overwrite = false;
        recording.noSpace = false;
        recording.video = context;
        const track1 = osn.AudioTrackFactory.create(160, 'track1');
        osn.AudioTrackFactory.setAtIndex(track1, 1);
        recording.signalHandler = (signal) => {obs.signals.push(signal)};

        // Getting scene
        const scene = osn.SceneFactory.fromName(sceneName);
        osn.Global.setOutputSource(0, scene);

        // Getting source
        let settings: ISettings = {};
        settings = inputSettings.colorSource;
        settings['height'] = 500;
        settings['width'] = 200;
        const source = osn.InputFactory.create(EOBSInputTypes.ColorSource, sourceName, settings);

        // Adding input source to scene to create scene item
        const sceneItem1 = scene.add(source);
        sceneItem1.video = context;
        sceneItem1.visible = true;
        let position1: IVec2 = {x: 1100,y: 200};
        sceneItem1.position = position1;
        
        
        const sceneItem2 = scene.add(source);
        sceneItem2.video = secondContext;
        sceneItem2.visible = true;
        let position2: IVec2 = {x: 500,y: 1200};
        sceneItem2.position = position2;

        recording.start();

        let signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Start);

        if (signalInfo.signal == EOBSOutputSignal.Stop) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputDidNotStart, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Start, GetErrorMessage(ETestErrorMsg.RecordingOutput));

            const recording2 = osn.AdvancedRecordingFactory.create();
            recording2.path = path.join(path.normalize(__dirname), '..', 'osnData');
            recording2.format = ERecordingFormat.MP4;
            recording2.useStreamEncoders = false;
            recording2.videoEncoder = osn.VideoEncoderFactory.create('obs_x264', 'video-encoder');
            recording2.overwrite = false;
            recording2.noSpace = false;
            recording2.video = secondContext;
            const track2 = osn.AudioTrackFactory.create(160, 'track2');
            osn.AudioTrackFactory.setAtIndex(track2, 1);
            recording2.signalHandler = (signal) => {obs.signals.push(signal)};
    
            recording2.start();
    
            let signalInfo2 = await obs.getNextSignalInfo(
                EOBSOutputType.Recording, EOBSOutputSignal.Start);
    
            if (signalInfo2.signal == EOBSOutputSignal.Stop) {
                throw Error(GetErrorMessage(
                    ETestErrorMsg.RecordOutputDidNotStart, signalInfo.code.toString(), signalInfo.error));
            }
    
            expect(signalInfo.type).to.equal(
                EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
            expect(signalInfo.signal).to.equal(
                EOBSOutputSignal.Start, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        await sleep(500);

        recording.stop();
        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stopping);
        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stopping, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stop);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stop, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Wrote);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Wrote, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        recording2.stop();

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stopping);
        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stopping, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Stop);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Stop, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        signalInfo = await obs.getNextSignalInfo(
            EOBSOutputType.Recording, EOBSOutputSignal.Wrote);

        if (signalInfo.code != 0) {
            throw Error(GetErrorMessage(
                ETestErrorMsg.RecordOutputStoppedWithError, signalInfo.code.toString(), signalInfo.error));
        }

        expect(signalInfo.type).to.equal(
            EOBSOutputType.Recording, GetErrorMessage(ETestErrorMsg.RecordingOutput));
        expect(signalInfo.signal).to.equal(
            EOBSOutputSignal.Wrote, GetErrorMessage(ETestErrorMsg.RecordingOutput));

        osn.AdvancedRecordingFactory.destroy(recording);

        osn.AdvancedRecordingFactory.destroy(recording2);

        osn.Global.setOutputSource(0, returnSource);

        secondContext.destroy();

        sceneItem1.source.release();
        sceneItem1.remove();
        sceneItem2.remove();
        scene.release();
    });
});