import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import Modal from 'react-modal';
import bindAll from 'lodash.bindall';

const customStyles = {
    overlay: {
        zIndex: '1000',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    content: {
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        padding: '10px 20px',
        transform: 'translate(-50%, -50%)',
        borderRadius: '20px'
    }
};

class AsyncModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleKeydown',
            'handleAfterOpen',
            'handleRequestClose',
            'handleSubmit',
            'handleCancel',
            'handleAfterClose'
        ]);
        this.state = {
            modalIsOpen: true,
            value: props.initialValue
        };
    }

    handleKeydown (keyEvent) {
        if (keyEvent.key === 'Enter') {
            this.handleSubmit();
            keyEvent.preventDefault();
        }
    }

    handleAfterOpen () {
        if (this.props.dialogType === 'prompt') {
            document.getElementById('valueInput').select();
        } else {
            document.getElementById('okButton').focus();
        }
        document.addEventListener('keydown', this.handleKeydown);
    }
 
    handleRequestClose () {
        this.props.reject();
    }
 
    handleSubmit () {
        this.setState({modalIsOpen: false}, this.props.resolve(this.state.value));
    }
  
    handleCancel () {
        this.setState({modalIsOpen: false}, this.props.reject());
    }
  
    handleAfterClose () {
        document.removeEventListener('keydown', this.handleKeydown);
    }

    render () {
        let valueInput;
        if (this.props.dialogType === 'prompt') {
            valueInput = (
                <input
                    id="valueInput"
                    type={this.props.valueType}
                    value={this.state.value}
                    // eslint-disable-next-line react/jsx-no-bind
                    onChange={e => this.setState({value: e.target.value})}
                    size={60}
                />
            );
        } else {
            valueInput = '';
        }
        let cancelButton;
        if (this.props.dialogType === 'alert') {
            cancelButton = '';
        } else {
            cancelButton = (
                <button
                    type="button"
                    onClick={this.handleCancel}
                >{'CANCEL'}</button>
            );
        }
        return (
            <Modal
                isOpen={this.state.modalIsOpen}
                onRequestClose={this.handleRequestClose}
                onAfterOpen={this.handleAfterOpen}
                onAfterClose={this.handleAfterClose}
                shouldCloseOnOverlayClick={false}
                style={customStyles}
            >
                <h2>{this.props.title}</h2>
                <p style={{whiteSpace: 'pre-line'}}>
                    {this.props.message || this.props.valueType}
                </p>
                <div>
                    {valueInput}
                    <div
                        style={{margin: '10px auto 10px 10px', textAlign: 'right'}}
                    >
                        {cancelButton}
                        <button
                            id="okButton"
                            type="submit"
                            onClick={this.handleSubmit}
                            style={{marginLeft: '10px', paddingLeft: '30px', paddingRight: '30px'}}
                        >{'OK'}</button>
                    </div>
                </div>
            </Modal>
        );
    }
}

AsyncModal.propTypes = {
    dialogType: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    valueType: PropTypes.string,
    initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    resolve: PropTypes.func,
    reject: PropTypes.func
};

export const prompt = ({
    title,
    message,
    valueType,
    initialValue
}) => {
    const wrapper = document.body.appendChild(document.createElement('div'));
    Modal.setAppElement(document.body);
    return new Promise((resolve, reject) => {
        ReactDOM.render(<AsyncModal
            dialogType={'prompt'}
            title={title}
            message={message}
            valueType={valueType || 'text'}
            initialValue={initialValue}
            resolve={resolve}
            reject={reject}
        />,
        wrapper);
    })
        .finally(() => {
            ReactDOM.unmountComponentAtNode(wrapper);
            setTimeout(() => wrapper.remove());
        });
};

export const confirm = ({
    title,
    message
}) => {
    const wrapper = document.body.appendChild(document.createElement('div'));
    Modal.setAppElement(document.body);
    return new Promise((resolve, reject) => {
        ReactDOM.render(<AsyncModal
            dialogType={'confirm'}
            title={title}
            message={message}
            resolve={resolve}
            reject={reject}
        />,
        wrapper);
    })
        .then(() => Promise.resolve(true))
        .catch(() => Promise.resolve(false))
        .finally(() => {
            ReactDOM.unmountComponentAtNode(wrapper);
            setTimeout(() => wrapper.remove());
        });
};

export const alert = ({
    title,
    message
}) => {
    const wrapper = document.body.appendChild(document.createElement('div'));
    Modal.setAppElement(document.body);
    return new Promise((resolve, reject) => {
        ReactDOM.render(<AsyncModal
            dialogType={'alert'}
            title={title}
            message={message}
            resolve={resolve}
            reject={reject}
        />,
        wrapper);
    })
        .then(() => Promise.resolve(true))
        .catch(() => Promise.resolve(true))
        .finally(() => {
            ReactDOM.unmountComponentAtNode(wrapper);
            setTimeout(() => wrapper.remove());
        });
};
